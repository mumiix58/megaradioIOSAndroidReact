import React from 'react';
import {Redirect} from 'expo-router';

/** Song history is not shipped; preserve old-link recovery without the retired screen. */
export default function SongHistoryRoute() { return <Redirect href="/(tabs)/profile"/>; }
