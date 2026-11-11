import React from 'react';
import { Redirect } from 'expo-router';
// Keep existing links working; the legacy directory UI has been removed.
export default function PublicProfiles() { return <Redirect href="/users" />; }
