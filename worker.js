import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  try {
    // Essayer de servir un fichier statique
    return await getAssetFromKV(event);
  } catch (e) {
    // Si le fichier n'existe pas, servir index.html (SPA fallback)
    try {
      let notFoundResponse = await getAssetFromKV(event, {
        mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/index.html`, req),
      });
      return new Response(notFoundResponse.body, {
        ...notFoundResponse,
        status: 200,
      });
    } catch (e) {
      return new Response('Page not found', { status: 404 });
    }
  }
}
