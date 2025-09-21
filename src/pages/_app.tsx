import type { AppProps } from "next/app";
import "../styles.css";
import Head from "next/head";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>RCHC Heating & Cooling Services</title>
      </Head>
      <header
        style={{
          background: "#333",
          color: "white",
          padding: "15px 25px", // taller padding
          display: "flex",
          alignItems: "center",
        }}
      >
        <img
          src="/logo.png"
          alt="RCHC Logo"
          style={{
            height: "80px", // bigger logo
            marginRight: "20px",
          }}
        />
        <span style={{ fontWeight: "bold", fontSize: "26px" }}>
          RCHC Heating & Cooling Services
        </span>
      </header>
      <Component {...pageProps} />
    </>
  );
}
