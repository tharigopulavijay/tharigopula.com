/* =========================================================================
   TCOS to the Tharigopula control plane, in shadow mode.

   TCOS owns every clinical decision. This file resolves a platform workspace
   for observation only - to check that the control plane agrees with TCOS
   about who a tenant is, before anything is allowed to depend on that.

   THREE THINGS THAT MUST STAY TRUE:

   1. IT NEVER BLOCKS. No binding, a thrown error, a slow control plane - all
      return a result and TCOS carries on. The whole point of shadow mode is
      that a shared service which is not yet trusted cannot take the clinic
      down. Nothing here is on the path of a consultation.

   2. IT NEVER AUTHORISES. The returned context is logged and compared, never
      consulted. TCOS's own doctor_id scoping and capability gates remain the
      only thing deciding what anybody may read or write. When enforcement is
      eventually switched on, that will be a separate, deliberate change with
      its own tests - not this file quietly starting to matter.

   3. IT SENDS NO PRODUCT KEY. The binding is to the TcosPlatform entrypoint,
      which fixes the product on the control-plane side. A bug here cannot
      ask for an EduCOS or INDOS workspace, because there is no field in
      which to name one.

   WHY doctor_id IS THE EXTERNAL REFERENCE. The platform's tenant is a
   workspace; TCOS's is a doctor row, which already means "the practice" -
   it owns the stock, the diary, the patient list and the books, and
   additional doctors live inside it as practitioners. So a doctor row maps
   to exactly one workspace, and doctor_id is the natural external
   reference. This is the incremental path the architecture thesis
   recommends, not a shortcut around it: no clinical row moves, and nothing
   in TCOS needs to know the platform exists.
   ========================================================================= */

export async function resolvePlatformWorkspaceShadow(env, externalWorkspaceRef,
                                                     correlationId = crypto.randomUUID()) {
  /* Not bound yet. The overwhelmingly common case until thari-control is
     deployed, and it must be silent - a warning on every request would train
     everyone to ignore the log. */
  if (!env.THARI_PLATFORM) return { mode: 'unconfigured', context: null };

  try {
    const context = await env.THARI_PLATFORM.resolveWorkspace({ externalWorkspaceRef });
    /* A null context means this doctor is not provisioned on the platform
       yet. During shadow that is expected and not an error - most doctors
       will not be mapped until a pilot is chosen. */
    return { mode: context ? 'shadow' : 'unmapped', context };
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'platform_shadow_resolution_failed',
      correlationId,
      /* The reference is opaque and carries no personal data, so it is safe
         to log and is the only way to tell which mapping is wrong. */
      externalWorkspaceRef,
      error: error instanceof Error ? error.message : 'unknown'
    }));
    return { mode: 'unavailable', context: null };
  }
}
