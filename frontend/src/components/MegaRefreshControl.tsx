import React from 'react';
import {RefreshControl,type RefreshControlProps} from 'react-native';
/** Native pull gesture/offsets remain platform-owned; brand ink is identical on iOS and Android. */
export function MegaRefreshControl(props:RefreshControlProps){return <RefreshControl {...props} tintColor="#FF4199" colors={['#FF4199']}/>;}
