/** Only local readiness blocks launch; remote catalog/translation refresh stays in the UI. */
export function canRevealStartup(state: { fonts: boolean; country: boolean; auth: boolean; locale: boolean; route: boolean }) {
  return state.fonts && state.country && state.auth && state.locale && state.route;
}
