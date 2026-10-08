import type { Page } from "@playwright/test";

/**
 * Records any attempt to touch the microphone or load the Vapi SDK, so tests
 * can assert that page loads never do either.
 */
export async function watchForMicAndVapi(page: Page) {
  const vapiRequests: string[] = [];
  page.on("request", (request) => {
    if (/vapi/i.test(request.url())) vapiRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __micRequests: number };
    w.__micRequests = 0;
    const media = navigator.mediaDevices;
    if (media?.getUserMedia) {
      const original = media.getUserMedia.bind(media);
      media.getUserMedia = (constraints?: MediaStreamConstraints) => {
        w.__micRequests += 1;
        return original(constraints);
      };
    }
  });
  return {
    vapiRequests,
    micRequests: () =>
      page.evaluate(() => (window as unknown as { __micRequests: number }).__micRequests),
  };
}

export async function hasNoHorizontalScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}
