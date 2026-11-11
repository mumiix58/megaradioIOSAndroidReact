import React from 'react';
import {Redirect} from 'expo-router';

/** Records is not shipped; old links return to Discover without exposing legacy UI. */
export default function RecordsRoute() { return <Redirect href="/(tabs)"/>; }
