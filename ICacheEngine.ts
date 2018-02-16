export default interface ICacheEngine {
  get: (key: string, setFn?: () => string|number|boolean) => string|number|boolean;
  set: (key: string, value: string|number|boolean) => void;
}
