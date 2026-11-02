// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

declare module "*.css" {
  const value: string;
  export default value;
}

interface RufflePlayerElement extends HTMLElement {
  volume: number;
  ruffle(): { load(options: object): Promise<void> };
  // registered by the SWF via ExternalInterface
  editorStartAudio?: () => void;
}

interface Window {
  __PLAYSEGA__?: { username?: string };
  __swfGetStagedLevel?: () => string | null;
  RufflePlayer?: { newest?: () => { createPlayer(): RufflePlayerElement } | undefined };
}
