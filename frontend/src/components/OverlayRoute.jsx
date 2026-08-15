import { useParams } from "react-router-dom";
import StreamOverlay from "./StreamOverlay.jsx";

/** Pulls the token out of the URL so StreamOverlay stays a plain component. */
export default function OverlayRoute() {
  const { token } = useParams();
  return <StreamOverlay token={token} />;
}
