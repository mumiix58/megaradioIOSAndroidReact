import { getProductionApiOrigin } from '../lib/apiOrigin';
import { Station } from "./megaRadioApi";

var STORAGE_KEY = "recentlyPlayed";
var MAX_RECENT_STATIONS = 6;
var API_BASE = getProductionApiOrigin();

export var recentlyPlayedService = {
  addStation: function(station: Station, token?: string | null): void {
    try {
      var existing = this.getStations();
      var filtered = existing.filter(function(s) { return s._id !== station._id; });
      var updated = [station].concat(filtered).slice(0, MAX_RECENT_STATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {}

    if (token) {
      fetch(API_BASE + '/api/recently-played', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stationId: station._id })
      }).catch(function() {});
    }
  },

  getStations: function(): Station[] {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as Station[];
      }
    } catch (err) {}
    return [];
  },

  syncFromApi: function(token: string): void {
    fetch(API_BASE + '/api/recently-played', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Failed');
      return response.json();
    })
    .then(function(data) {
      var apiStations = Array.isArray(data) ? data : (data.stations || data.recentlyPlayed || []);
      if (apiStations.length > 0) {
        var localStations: Station[] = [];
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          if (stored) localStations = JSON.parse(stored) || [];
        } catch(e) {}

        var merged: Station[] = [];
        var seenIds: Record<string, boolean> = {};
        apiStations.forEach(function(s: Station) {
          if (!seenIds[s._id]) {
            merged.push(s);
            seenIds[s._id] = true;
          }
        });
        localStations.forEach(function(s: Station) {
          if (!seenIds[s._id]) {
            merged.push(s);
            seenIds[s._id] = true;
          }
        });

        merged = merged.slice(0, MAX_RECENT_STATIONS);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch(e) {}
      }
    })
    .catch(function(err) {
      console.warn('[RecentlyPlayed] Failed to sync from API:', err);
    });
  },

  clear: function(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {}
  }
};
