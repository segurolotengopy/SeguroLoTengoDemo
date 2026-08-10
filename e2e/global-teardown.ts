import { borrarClaveDelPanel } from "./support/secreto-panel";

export default async function globalTeardown(): Promise<void> {
  await borrarClaveDelPanel();
}
