/** Vrai si le navigateur sait afficher du WebGL (sinon : versions de secours en CSS / HTML). */
export const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
};
