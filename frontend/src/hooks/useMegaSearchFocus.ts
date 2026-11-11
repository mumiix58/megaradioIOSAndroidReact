import {useCallback,useState} from 'react';
import {Platform,StyleSheet} from 'react-native';

/** Focus belongs to the whole search field, never the browser's inner input ring. */
export function useMegaSearchFocus() {
  const [focused,setFocused]=useState(false);
  const onFocus=useCallback(()=>setFocused(true),[]);
  const onBlur=useCallback(()=>setFocused(false),[]);
  return {
    onFocus,onBlur,
    fieldStyle:[styles.field,focused&&styles.focused],
    inputStyle:Platform.OS==='web'?styles.webInput:undefined,
    selectionColor:'#FF4199',
  };
}
const styles=StyleSheet.create({
  field:{borderWidth:1,borderColor:'transparent'},
  focused:{borderColor:'#FF4199'},
  webInput:{outlineWidth:0,outlineStyle:'none',boxShadow:'none',WebkitAppearance:'none'} as any,
});
