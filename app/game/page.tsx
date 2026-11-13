import { Suspense } from "react";
import GameHost from "./game-host";
export default function GamePage() {
  return <Suspense fallback={null}><GameHost /></Suspense>;
}
