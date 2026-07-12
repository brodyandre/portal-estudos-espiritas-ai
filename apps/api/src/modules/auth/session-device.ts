const detectBrowser = (summary: string) => {
  if (/edg\//iu.test(summary)) {
    return "Edge";
  }

  if (/chrome\//iu.test(summary) && !/edg\//iu.test(summary)) {
    return "Chrome";
  }

  if (/firefox\//iu.test(summary)) {
    return "Firefox";
  }

  if (/safari\//iu.test(summary) && !/chrome\//iu.test(summary)) {
    return "Safari";
  }

  return null;
};

const detectPlatform = (summary: string) => {
  if (/android|iphone|ipad|mobile/iu.test(summary)) {
    return "móvel";
  }

  if (/windows/iu.test(summary)) {
    return "Windows";
  }

  if (/mac os|macintosh/iu.test(summary)) {
    return "macOS";
  }

  if (/linux/iu.test(summary)) {
    return "Linux";
  }

  return null;
};

export const buildSessionDeviceLabel = (userAgentSummary?: string | null) => {
  const summary = userAgentSummary?.trim() ?? "";

  if (!summary) {
    return "Dispositivo desconhecido";
  }

  const browser = detectBrowser(summary);
  const platform = detectPlatform(summary);

  if (platform === "móvel") {
    return browser ? `${browser} no celular` : "Navegador móvel";
  }

  if (browser && platform) {
    return `${browser} em ${platform}`;
  }

  if (browser) {
    return browser;
  }

  if (platform) {
    return `Navegador em ${platform}`;
  }

  return "Dispositivo desconhecido";
};
