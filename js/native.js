'use strict';
/* ─────────── the Android app shell (Capacitor): back button, status bar, haptics. Does nothing on the web. ─────────── */
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
if (NATIVE){
  document.documentElement.classList.add('native');
  const P = Capacitor.Plugins || {};
  try { if (P.StatusBar){ P.StatusBar.setStyle({ style: 'DARK' }); P.StatusBar.setBackgroundColor({ color: '#05070f' }); } } catch (e) {}
  // the phone's back button closes whatever is on top, one layer at a time; with nothing open it sends the app to the background
  const closeTop = () => {
    if (!$('#fbSheet').hidden){ $('#fbSheet').hidden = true; return true; }
    if (!$('#reader').classList.contains('gone')){ closeReader(); return true; }
    if (nb.classList.contains('on')){ nbClose(); return true; }
    if (!$('#win').classList.contains('gone') && $('#win').classList.contains('on')){ closeWin(); exitGame(); return true; }
    if ($('#result').classList.contains('on')){ exitGame(); return true; }
    if ($('#rules').classList.contains('on')){ $('#rules').classList.remove('on'); return true; }
    if (typeof tourOn !== 'undefined' && tourOn){ endTour(); return true; }
    if ($('#about').classList.contains('on')){ endOnboard(); return true; }
    if (card.classList.contains('on')){ card.classList.remove('on'); if (game.on && !game.started) startPlay(); return true; }
    if ($('#enter').classList.contains('on')){ $('#enter .cx').click(); return true; }
    return false;
  };
  try { if (P.App) P.App.addListener('backButton', () => { if (!closeTop()) P.App.minimizeApp(); }); } catch (e) {}
  // a light buzz on the moments that matter
  if (P.Haptics){
    const buzz = (kind, style) => () => { try { P.Haptics[kind](style ? { style } : undefined); } catch (e) {} };
    const wrap = (name, fn) => { const orig = SFX[name]; if (typeof orig !== 'function') return; SFX[name] = function(){ fn(); return orig.apply(this, arguments); }; };
    wrap('pick', buzz('impact', 'LIGHT')); wrap('enter', buzz('impact', 'MEDIUM')); wrap('chime', buzz('notification', 'SUCCESS')); wrap('sad', buzz('notification', 'WARNING'));
  }
  try { if (P.SplashScreen) setTimeout(() => P.SplashScreen.hide(), 400); } catch (e) {}
}
