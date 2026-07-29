import '../styles/globals.css';

import { LanguageProvider } from '../lib/LanguageContext';
import SplashScreen from '../components/SplashScreen';


export default function App({ Component, pageProps }) {

  return (

    <LanguageProvider>

      <SplashScreen>

        <Component {...pageProps} />

      </SplashScreen>

    </LanguageProvider>

  );

}