import { runImport } from "../composition/root";

(async () => {
  await runImport();
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
