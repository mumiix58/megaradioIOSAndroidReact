import React from 'react';
import {StationCountryBadge} from '../StationCountryBadge';
import type {Station} from '../../types';

/** Hit target follows the centered card; each sliding card draws its own flag. */
export function GroupDiscoveryCountry({station,unit,disabled}:{station:Station;unit:number;disabled:boolean}){
 return <StationCountryBadge station={station} unit={unit} disabled={disabled} showFlag={false} testID="group-discovery-country" style={{left:259.5*unit,top:190*unit}}/>;
}
