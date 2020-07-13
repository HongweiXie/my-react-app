/* global window */

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import {AmbientLight, PointLight, LightingEffect} from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {PolygonLayer, ScatterplotLayer} from '@deck.gl/layers';
import {TripsLayer} from '@deck.gl/geo-layers';
import {HeatmapLayer} from '@deck.gl/aggregation-layers';
import mapboxgl from 'mapbox-gl';
import {MapboxLayer} from '@deck.gl/mapbox';

// Set your mapbox token here
const MAPBOX_TOKEN = process.env.MapboxAccessToken || 'pk.eyJ1Ijoic2h1b2ZhbiIsImEiOiJja2NlZ3BoOWUwODYwMnpwaGpkamx0aGJmIn0.rkJY6OYlU7c7F0rFsafapQ'; // eslint-disable-line

mapboxgl.accessToken = MAPBOX_TOKEN

const mapboxBuildingLayer = {
  id: '3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  filter: ['==', 'extrude', 'true'],
  type: 'fill-extrusion',
  zoom: 10,
  minZoom: 1,
  maxZoom: 25,
  paint: {
    'fill-extrusion-color': '#4a5057',
    'fill-extrusion-height': ['get', 'height']
  }
};

// Source data CSV
const DATA_URL = {
  BUILDINGS: 'res/buildings.json', // eslint-disable-line
  TRIPS: 'res/trips-v7.json', // eslint-disable-line
  PICK_HEATMAPS: 'res/uber-pickup-locations.json'
};

const ambientLight = new AmbientLight({ 
  color: [255, 255, 255],
  intensity: 1.0
});

const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 2.0,
  position: [-74.05, 40.7, 8000]
});

const lightingEffect = new LightingEffect({ambientLight, pointLight});

const material = {
  ambient: 0.1,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [60, 64, 70]
};

const DEFAULT_THEME = {
  // trailColor0: [253, 128, 93],
  // trailColor1: [23, 184, 190],
  buildingColor: [74, 80, 87],
  trailColor0: [253, 128, 93],
  trailColor1: [23, 240, 110],
  material,
  effects: [lightingEffect],
  groundColor: [0, 0, 0, 0]
};

const TRIP_PARAM = {
  trailLength: 180,

}

// params for heatmap
const COLOR_RANGE = [
  [1, 152, 189, 80],
  [73, 227, 206, 80],
  [216, 254, 181, 80],
  [254, 237, 177, 80],
  [254, 173, 84, 80],
  [209, 55, 78, 80]
  // [255, 255, 178, 100],
  // [254, 217, 118, 100],
  // [254, 178, 76, 100],
  // [253, 141, 60, 100],
  // [240, 59, 32, 100],
  // [189, 0, 38, 100]
];

const HM_PARAM = {
  intensity: 1,
  threshold: 0.03,
  radiusPixels: 50
}

const INITIAL_VIEW_STATE = {
  longitude: -74,
  latitude: 40.72,
  zoom: 13,
  minZoom: 1,
  maxZoom: 25,
  pitch: 65,
  bearing: 20
};

const landCover = [[[-74.0, 40.7], [-74.02, 40.7], [-74.02, 40.72], [-74.0, 40.72]]];
var alpha, beta, gamma;
var vLongitude, vLatitude, vZoom;
vLongitude= INITIAL_VIEW_STATE.longitude;
vLatitude = INITIAL_VIEW_STATE.latitude;
vZoom = INITIAL_VIEW_STATE.zoom;
window.addEventListener("deviceorientation", handleOrientation, true);
  function handleOrientation(orientData) {
    // var absolute = orientData.absolute;
    alpha = orientData.alpha;
    beta = orientData.beta;
    alpha = -alpha+360
    gamma = orientData.gamma;
    gamma = Math.abs(gamma)
    gamma = Math.min(gamma,60)
    // console.log(gamma);
  }

export default function App({
                              data=DATA_URL.PICK_HEATMAPS,
                              buildings = DATA_URL.BUILDINGS,
                              trips = DATA_URL.TRIPS,
                              mapStyle = 'mapbox://styles/mapbox/dark-v9',
                              trailLength = TRIP_PARAM.trailLength,
                              theme = DEFAULT_THEME,
                              loopLength = 1800, // unit corresponds to the timestamp in source data
                              animationSpeed = 1,
                              intensity = HM_PARAM.intensity,
                              threshold = HM_PARAM.threshold,
                              radiusPixels = HM_PARAM.radiusPixels,
                              colorRange = COLOR_RANGE
                            }) {
  const [time, setTime] = useState(0);

  const [animation] = useState({});
  const [initialViewState, setInitialViewState] = useState({
    latitude: INITIAL_VIEW_STATE.latitude,
    longitude: INITIAL_VIEW_STATE.longitude,
    zoom: INITIAL_VIEW_STATE.zoom,
    bearing: INITIAL_VIEW_STATE.bearing,
    pitch: INITIAL_VIEW_STATE.pitch,
  });

  const animate = () => {
    // setTime(t=>(console.log(t)));
    setTime(t => (t + animationSpeed) % loopLength);
    setInitialViewState(viewState => ({
      ...viewState,
      longitude: vLongitude,
      latitude: vLatitude,
      zoom : vZoom,
      bearing: alpha,
      pitch: gamma
    }));
    // console.log(time);
    animation.id = window.requestAnimationFrame(animate);
  };

  useEffect(
    () => {
      animation.id = window.requestAnimationFrame(animate);
      return () => window.cancelAnimationFrame(animation.id);
    },
    [animation]
  );

  const mapRef = useRef(null);
  const deckRef =useRef(null);
  const onMapLoad = useCallback(() => {
    const map = mapRef.current.getMap();
    const deck = deckRef.current.deck;

    const hm_layer = new MapboxLayer({
      data,
      type: HeatmapLayer,
      id: 'heatmp-layer',
      pickable: true,
      getPosition: d => [d[0], d[1]],
      getWeight: d => d[2],
      radiusPixels,
      intensity,
      threshold,
      colorRange
    }, deck)
    map.addLayer(mapboxBuildingLayer);
    map.addLayer(hm_layer);
    // map.addLayer(ground_layer);
    // map.addLayer(trip_layer);
  }, []);

  const layers = [
    // // This is only needed when using shadow effects
    new PolygonLayer({
      id: 'ground',
      data: landCover,
      getPolygon: f => f,
      stroked: false,
      getFillColor: DEFAULT_THEME.groundColor
    }),
    new TripsLayer({
      id: 'trips',
      data: trips,
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      getColor: d => (d.vendor === 0 ? theme.trailColor0 : theme.trailColor1),
      opacity: 0.3,
      widthMinPixels: 2,
      rounded: true,
      trailLength,
      currentTime: time,
      antialiase: true,
      shadowEnabled: false
    }),
    // new PolygonLayer({
    //   id: 'buildings',
    //   data: buildings,
    //   extruded: true,
    //   wireframe: false,
    //   opacity: 0.5,
    //   getPolygon: f => f.polygon,
    //   getElevation: f => f.height,
    //   getFillColor: theme.buildingColor,
    //   material: theme.material
    // }),
  ];

  return (
    <DeckGL
      ref={deckRef}
      layers={layers}
      effects={theme.effects}
      initialViewState={initialViewState}
      controller={true}
      onViewStateChange = {({viewState}) => {
        // console.log(viewState);
        vLongitude = viewState.longitude
        vLatitude = viewState.latitude
        vZoom = viewState.zoom
      }}
      // onWebGLInitialized={setGLContext}
      // glOptions={{
      //   /* To render vector tile polygons correctly */
      //   stencil: true
      // }}
    >
      {/* {glContext && ( */}
      <StaticMap
        reuseMaps
        ref={mapRef}
        mapStyle={mapStyle}
        preventStyleDiffing={true}
        mapboxApiAccessToken={MAPBOX_TOKEN}
        onLoad={onMapLoad}
      />
      {/* )} */}
    </DeckGL>
  );
}

