const RENDER_ORIGIN = "https://absmg-apps.onrender.com";

export async function onRequest(context) {
  const request = context.request;
  const incomingUrl = new URL(request.url);

  // Forward the original API path and query parameters to Render.
  const upstreamUrl = new URL(
    incomingUrl.pathname + incomingUrl.search,
    RENDER_ORIGIN
  );

  const method = request.method.toUpperCase();
  const headers = new Headers(request.headers);

  // Let Cloudflare and the upstream server set their own host headers.
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");

  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set(
    "x-forwarded-proto",
    incomingUrl.protocol.replace(":", "")
  );

  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method,
      headers,
      ...(hasBody && request.body
        ? { body: request.body }
        : {}),
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);

    const responseHeaders = new Headers(
      upstreamResponse.headers
    );

    // Do not forward stale transport headers.
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("connection");
    responseHeaders.delete("transfer-encoding");

    // Keep redirects on the public frontend domain when the
    // upstream redirects to the Render origin.
    const location = responseHeaders.get("location");

    if (location) {
      try {
        const redirectUrl = new URL(location, RENDER_ORIGIN);

        if (redirectUrl.origin === RENDER_ORIGIN) {
          responseHeaders.set(
            "location",
            incomingUrl.origin +
              redirectUrl.pathname +
              redirectUrl.search +
              redirectUrl.hash
          );
        }
      } catch {
        // Preserve an unparseable Location header.
      }
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Nodysom API proxy error:", error);

    return Response.json(
      {
        success: false,
        error:
          "Nodysom AI backend is temporarily unreachable. Please try again.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
