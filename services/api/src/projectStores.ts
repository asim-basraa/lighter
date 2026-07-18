import { join } from 'node:path';
import { SpecStore } from './specStore.js';

/**
 * A project id used as a filesystem path segment. It comes from the DB (resolved from a bearer token,
 * not the URL), but we still validate it as a safe slug — defense-in-depth against a crafted id ever
 * escaping the store root.
 */
const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Per-project git-backed spec stores (#87 scoping). Each project's screens live under
 * `<root>/<projectId>/…` in that project's own git repo, so two projects can hold a screen with the
 * same id without collision and never see each other's designs. Stores are created + `init()`ed
 * lazily and cached; the init promise is memoized so concurrent requests share one init.
 */
export class ProjectStores {
  private readonly stores = new Map<string, SpecStore>();
  private readonly inits = new Map<string, Promise<void>>();

  constructor(private readonly root: string) {}

  /** Get (lazily creating + initializing) the SpecStore for a project. */
  async forProject(projectId: string): Promise<SpecStore> {
    if (!PROJECT_ID.test(projectId)) {
      throw new Error(`invalid project id "${projectId}"`);
    }
    let store = this.stores.get(projectId);
    if (!store) {
      store = new SpecStore(join(this.root, projectId));
      this.stores.set(projectId, store);
    }
    let init = this.inits.get(projectId);
    if (!init) {
      init = store.init();
      this.inits.set(projectId, init);
    }
    await init;
    return store;
  }
}
