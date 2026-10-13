import { onSnapshot, type DocumentData, type Query, type QuerySnapshot } from "firebase/firestore";

/** Keep live updates, but never leave a disconnected screen spinning forever. */
export function subscribeWithDeadline<T extends DocumentData>(
  source: Query<T>,
  receive: (snapshot: QuerySnapshot<T>) => void,
  fail: (error: Error) => void,
) {
  const timer = setTimeout(() => fail(new Error("Data is taking too long to load. Check the internet connection and retry.")), 15_000);
  const unsubscribe = onSnapshot(source, snapshot => {
    clearTimeout(timer); receive(snapshot);
  }, error => { clearTimeout(timer); fail(error); });
  return () => { clearTimeout(timer); unsubscribe(); };
}
