import { Component, type ReactNode } from 'react';
import { reportTvEvent } from '@/lib/tvObservability';

export class TvErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch() { reportTvEvent('react_error','render_error',{module:'main'}); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" style={{padding:120,color:'#fff',background:'#0e0e0e',fontSize:28}}>
      <h1>MegaRadio could not display this screen</h1><p>Please retry. Diagnostic sharing is optional in Settings.</p>
      <button autoFocus onKeyDown={event => {if(event.key==='Enter'||event.keyCode===13)window.location.reload();}} onClick={()=>window.location.reload()} style={{padding:24,fontSize:28,color:'#fff',background:'#ff4199',border:'3px solid #fff'}}>Try again</button>
    </div>;
  }
}
