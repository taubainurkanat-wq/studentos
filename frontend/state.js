/* Shared workspace and authentication state for this browser tab. */
export const TOKEN_KEY = 'studentos_session';
export const appState = {token:sessionStorage.getItem(TOKEN_KEY),data:null,page:'overview',filter:'all',search:'',authMode:'login',publicDemo:false};
