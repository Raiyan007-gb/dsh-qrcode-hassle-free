window.__ModuleLoader__.load({
  id: "dsh-remote-tunnel-easy",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");

    //#region css
    const css = [
      ".dshmh-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:8px;min-width:0;list-style:none;transition:border-color .16s,background .16s;overflow:hidden}",
      ".dshmh-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}",
      ".dshmh-header{width:100%;color:inherit;cursor:pointer;text-align:left;font:inherit;background:0 0;border:0;align-items:center;gap:8px;padding:10px 14px;display:flex}",
      ".dshmh-header:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
      ".dshmh-headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex;overflow:hidden}",
      ".dshmh-name{color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;font-weight:600;overflow:hidden}",
      ".dshmh-description{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:12px;overflow:hidden}",
      ".dshmh-pending{color:var(--dsw-alias-state-warn-primary);white-space:nowrap;flex:none;font-size:12px}",
      ".dshmh-chevron{color:var(--dsw-alias-label-tertiary);flex:none;font-size:13px;transition:transform .12s}",
      ".dshmh-chevronOpen{transform:rotate(180deg)}",
      ".dshmh-body{flex-direction:column;gap:14px;padding:0 14px 14px;display:flex}",
      ".dshmh-qrRow{display:flex;gap:16px;align-items:center;flex-wrap:wrap}",
      ".dshmh-qr{border:1px solid var(--dsw-alias-border-l2);background:#ffffff;border-radius:6px;padding:10px;flex:none}",
      ".dshmh-qr svg{display:block}",
      ".dshmh-linkBlock{flex-direction:column;gap:8px;min-width:0;flex:1;display:flex}",
      ".dshmh-link{color:var(--dsw-alias-state-business-primary);font-size:12px;text-decoration:none;word-break:break-all}",
      ".dshmh-link:hover{text-decoration:underline}",
      ".dshmh-hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px}",
      ".dshmh-failed{color:var(--dsw-alias-state-error-primary);font-size:12px}",
      ".dshmh-field{flex-direction:column;gap:4px;min-width:0;display:flex}",
      ".dshmh-label{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}",
      ".dshmh-input{border:1px solid var(--dsw-alias-border-l2);font:inherit;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);border-radius:6px;padding:6px 8px;font-size:13px;transition:border-color .13s,box-shadow .13s;width:100%}",
      ".dshmh-input:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed)}",
      ".dshmh-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}",
      ".dshmh-input:disabled{opacity:.6;cursor:default}",
      ".dshmh-check{gap:6px;align-items:center;display:flex;color:var(--dsw-alias-label-primary);font-size:13px;cursor:pointer}",
      ".dshmh-check input{accent-color:var(--dsw-alias-state-business-primary)}",
      ".dshmh-footer{justify-content:flex-end;align-items:center;gap:8px;display:flex;flex-wrap:wrap}",
      ".dshmh-btn{font:inherit;cursor:pointer;border-radius:6px;padding:5px 12px;font-size:13px;transition:background-color .13s,border-color .13s,color .13s}",
      ".dshmh-save{border:1px solid var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground)}",
      ".dshmh-save:hover:not(:disabled){border-color:var(--dsw-alias-button-info-hover);background:var(--dsw-alias-button-info-hover)}",
      ".dshmh-save:disabled{opacity:.5;cursor:default}",
    ].join("");
    const tagId = "dsh-remote-tunnel-easy/card.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-remote-tunnel-easy";
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }
    //#endregion

    const BRIDGE_PREFIX = "/api/dsh-remote-handoff-settings";
    const NS = "remote-handoff";
    const lang = typeof navigator !== "undefined" && /^zh\b/i.test(navigator.language ?? "") ? "zh" : "en";
    const I18N = {
      zh: {
        description: "手机免配置访问 —— 扫描二维码即可在手机上打开当前会话",
        starting: "隧道启动中…",
        installing: "正在准备 cloudflared…",
        ready: "扫描二维码在手机上打开当前会话",
        failed: "隧道不可用",
        openLink: "在手机上打开链接 ↗",
        copy: "复制链接",
        copied: "已复制",
        regenerate: "重新生成",
        regenerating: "正在重新生成…",
        target: "隧道目标（本机 harness 地址）",
        cloudflaredPath: "cloudflared 路径",
        sessionHandoff: "会话握手（扫描后进入当前会话）",
        save: "保存",
        saving: "保存中…",
        unsaved: "未保存",
        saveFailed: "保存失败",
        pluginUpdate: "插件更新",
        checkUpdate: "检查更新",
        checkingUpdate: "检查中…",
        upToDate: "已是最新",
        updateAvailable: "有可用更新",
        updating: "更新中…",
        updated: "已更新 — 重启 dsh web 生效",
        updateFailed: "更新失败",
        restartRequired: "重启 dsh web 以应用更新",
        renamedTo: "已更名为 dsh-remote-tunnel-easy",
        migrate: "迁移到 dsh-remote-tunnel-easy",
        migrated: "已迁移 — 重启 dsh web 生效",
        viewNewPackage: "查看新包 ↗",
        unavailable: "设置不可用 —— remote-handoff 桥接未暴露。",
      },
      en: {
        description: "Hassle-free remote access — scan the QR to open the current session on your phone",
        starting: "Starting tunnel…",
        installing: "Preparing cloudflared…",
        ready: "Scan the QR to open the current session on your phone",
        failed: "Tunnel unavailable",
        openLink: "Open link on phone ↗",
        copy: "Copy link",
        copied: "Copied",
        regenerate: "Regenerate",
        regenerating: "Regenerating…",
        target: "Tunnel target (local harness address)",
        cloudflaredPath: "cloudflared path",
        sessionHandoff: "Session handoff (scan opens the current session)",
        save: "Save",
        saving: "Saving…",
        unsaved: "Unsaved",
        saveFailed: "Save failed",
        pluginUpdate: "Plugin update",
        checkUpdate: "Check for updates",
        checkingUpdate: "Checking…",
        upToDate: "Up to date",
        updateAvailable: "Update available",
        updating: "Updating…",
        updated: "Updated — restart dsh web to apply",
        updateFailed: "Update failed",
        restartRequired: "Restart dsh web to apply",
        renamedTo: "Renamed to dsh-remote-tunnel-easy",
        migrate: "Migrate to dsh-remote-tunnel-easy",
        migrated: "Migrated — restart dsh web to apply",
        viewNewPackage: "View new package ↗",
        unavailable: "Settings unavailable — remote-handoff bridge not exposed.",
      },
    };

    async function bridgeDescribe() {
      const response = await fetch(`${BRIDGE_PREFIX}/describe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.json();
    }

    async function bridgeMutate(payload) {
      const response = await fetch(`${BRIDGE_PREFIX}/mutate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response.json();
    }

    async function bridgeStatus() {
      const response = await fetch(`${BRIDGE_PREFIX}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.json();
    }

    async function bridgeRegenerate() {
      const response = await fetch(`${BRIDGE_PREFIX}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.json();
    }

    async function bridgeUpdateStatus() {
      const response = await fetch(`${BRIDGE_PREFIX}/update-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.json();
    }

    async function bridgeCheckUpdate() {
      const response = await fetch(`${BRIDGE_PREFIX}/check-update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.json();
    }

    async function bridgeUpdate() {
      const response = await fetch(`${BRIDGE_PREFIX}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.json();
    }

    /** Render a QR matrix (count×count 0/1 cells) to a compact SVG element tree. */
    function qrSvg(matrix, size) {
      const cell = size / matrix.count;
      const dark = [];
      for (let r = 0; r < matrix.count; r++) {
        for (let c = 0; c < matrix.count; c++) {
          if (matrix.modules[r][c]) {
            dark.push(
              react_jsx_runtime.jsx("rect", {
                key: r + ":" + c,
                x: c * cell,
                y: r * cell,
                width: cell,
                height: cell,
                fill: "#000000",
              })
            );
          }
        }
      }
      return react_jsx_runtime.jsx("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 " + size + " " + size,
        width: size,
        height: size,
        children: [
          react_jsx_runtime.jsx("rect", { x: 0, y: 0, width: size, height: size, fill: "#ffffff" }),
          dark,
        ],
      });
    }

    function RemoteHandoffCard() {
      const [open, setOpen] = react.useState(false);
      const [state, setState] = react.useState({ status: "loading" });
      const [tunnelStatus, setTunnelStatus] = react.useState({ state: "starting" });
      const [target, setTarget] = react.useState("");
      const [autoTarget, setAutoTarget] = react.useState("");
      const [cloudflaredPath, setCloudflaredPath] = react.useState("");
      const [sessionHandoff, setSessionHandoff] = react.useState(true);
      const [dirty, setDirty] = react.useState(false);
      const [saving, setSaving] = react.useState(false);
      const [failed, setFailed] = react.useState(false);
      const [copied, setCopied] = react.useState(false);
      const [regenerating, setRegenerating] = react.useState(false);
      const [updateStatus, setUpdateStatus] = react.useState({ state: "idle", currentVersion: null, latestVersion: null });
      const [checking, setChecking] = react.useState(false);
      const [updating, setUpdating] = react.useState(false);

      const load = react.useCallback(async () => {
        try {
          const result = await bridgeDescribe();
          if (result.ok) {
            const view = result.value.namespaces.find((n) => n.ns === NS);
            if (view) {
              const v = view.value ?? {};
              setTarget(v.tunnelTarget ?? "");
              setCloudflaredPath(v.cloudflaredPath ?? "");
              setSessionHandoff(v.sessionHandoff !== false);
              setState({ status: "ready", writable: result.value.writable });
            } else {
              setState({ status: "unavailable" });
            }
          } else {
            setState({ status: "unavailable" });
          }
        } catch {
          setState({ status: "unavailable" });
        }
      }, []);

      const pollStatus = react.useCallback(async () => {
        try {
          const result = await bridgeStatus();
          if (result.ok) {
            setTunnelStatus(result.value);
            // Track the Host-resolved auto target so the input can prefill and
            // stay truthful when the persisted `tunnelTarget` is empty ("auto").
            if (result.value && typeof result.value.resolvedTarget === "string") {
              setAutoTarget(result.value.resolvedTarget);
            }
          }
        } catch {}
      }, []);

      const regenerate = async () => {
        setRegenerating(true);
        try {
          await bridgeRegenerate();
        } catch {
          // Network/lifecycle failure: the next pollStatus reveals the state.
        }
        pollStatus();
      };

      // Clear the "regenerating" flag once the Host reports a terminal state
      // (ready with a fresh URL, or failed) so the button re-enables.
      react.useEffect(() => {
        if (regenerating && (tunnelStatus.state === "ready" || tunnelStatus.state === "failed")) {
          setRegenerating(false);
        }
      }, [regenerating, tunnelStatus.state]);

      // Fast-poll while regenerating so the new QR appears promptly.
      react.useEffect(() => {
        if (!regenerating) return;
        const t = setInterval(pollStatus, 700);
        return () => clearInterval(t);
      }, [regenerating, pollStatus]);

      react.useEffect(() => {
        load();
      }, [load]);

      react.useEffect(() => {
        pollStatus();
        const t = setInterval(pollStatus, 5000);
        return () => clearInterval(t);
      }, [pollStatus]);

      const refreshUpdateStatus = react.useCallback(async () => {
        try {
          const result = await bridgeUpdateStatus();
          if (result.ok) setUpdateStatus(result.value);
        } catch {}
      }, []);

      const doCheckUpdate = async () => {
        setChecking(true);
        try {
          const result = await bridgeCheckUpdate();
          if (result.ok) setUpdateStatus(result.value);
          else if (result.value) setUpdateStatus(result.value);
          else if (result.error || result.message) setUpdateStatus((prev) => ({ ...prev, state: "failed", error: result.message || result.error }));
        } catch {}
        setChecking(false);
      };

      const doUpdate = async () => {
        setUpdating(true);
        try {
          const result = await bridgeUpdate();
          if (result.ok) setUpdateStatus(result.value);
          else if (result.value) setUpdateStatus(result.value);
          else if (result.error || result.message) setUpdateStatus((prev) => ({ ...prev, state: "failed", error: result.message || result.error }));
        } catch {}
        setUpdating(false);
      };

      react.useEffect(() => {
        refreshUpdateStatus();
      }, [refreshUpdateStatus]);

      const save = async () => {
        setSaving(true);
        setFailed(false);
        try {
          const ops = [
            { op: "set", path: ["tunnelTarget"], value: target },
            { op: "set", path: ["cloudflaredPath"], value: cloudflaredPath },
            { op: "set", path: ["sessionHandoff"], value: sessionHandoff },
          ];
          const result = await bridgeMutate({ ns: NS, ops });
          if (result.ok) {
            setDirty(false);
            load();
          } else {
            setFailed(true);
          }
        } catch {
          setFailed(true);
        } finally {
          setSaving(false);
        }
      };

      const copyLink = async () => {
        if (!tunnelStatus.accessUrl) return;
        try {
          await navigator.clipboard.writeText(tunnelStatus.accessUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      };

      if (state.status === "loading") return null;
      if (state.status === "unavailable") {
        const zh = lang === "zh";
        return react_jsx_runtime.jsx("li", {
          className: "dshmh-card",
          children: react_jsx_runtime.jsx("div", {
            className: "dshmh-body",
            style: { padding: "14px" },
            children: react_jsx_runtime.jsx("span", {
              className: "dshmh-failed",
              children: zh ? I18N.zh.unavailable : I18N.en.unavailable,
            }),
          }),
        });
      }

      const t = lang === "zh" ? I18N.zh : I18N.en;
      const hasQr = tunnelStatus.state === "ready" && tunnelStatus.matrix;
      const installing = tunnelStatus.state !== "ready" && tunnelStatus.state !== "failed"
        && typeof tunnelStatus.phase === "string" && tunnelStatus.phase !== "starting tunnel…";
      const statusLabel = tunnelStatus.state === "ready"
        ? t.ready
        : tunnelStatus.state === "failed" ? t.failed : (installing ? t.installing : t.starting);
      const targetValue = target || autoTarget;

      return react_jsx_runtime.jsx("li", {
        className: open ? "dshmh-card dshmh-cardOpen" : "dshmh-card",
        children: [
          react_jsx_runtime.jsx("button", {
            type: "button",
            className: "dshmh-header",
            "aria-expanded": open,
            onClick: () => setOpen(!open),
            children: [
              react_jsx_runtime.jsx("span", {
                className: "dshmh-headText",
                children: [
                  react_jsx_runtime.jsx("span", { className: "dshmh-name", children: "DSH Remote" }),
                  react_jsx_runtime.jsx("span", { className: "dshmh-description", children: t.description }),
                ],
              }),
              dirty ? react_jsx_runtime.jsx("span", { className: "dshmh-pending", children: t.unsaved }) : null,
              react_jsx_runtime.jsx("span", { className: "dshmh-pending", children: statusLabel }),
              react_jsx_runtime.jsx("span", {
                className: open ? "dshmh-chevron dshmh-chevronOpen" : "dshmh-chevron",
                children: "▾",
              }),
            ],
          }),
          open
            ? react_jsx_runtime.jsx("div", {
                className: "dshmh-body",
                children: [
                  tunnelStatus.state === "failed"
                    ? react_jsx_runtime.jsx("span", {
                        className: "dshmh-failed",
                        children: tunnelStatus.error ? t.failed + ": " + tunnelStatus.error : t.failed,
                      })
                    : null,
                  hasQr
                    ? react_jsx_runtime.jsx("div", {
                        className: "dshmh-qrRow",
                        children: [
                          react_jsx_runtime.jsx("div", {
                            className: "dshmh-qr",
                            children: qrSvg(tunnelStatus.matrix, 176),
                          }),
                          react_jsx_runtime.jsx("div", {
                            className: "dshmh-linkBlock",
                            children: [
                              react_jsx_runtime.jsx("a", {
                                className: "dshmh-link",
                                href: tunnelStatus.accessUrl,
                                target: "_blank",
                                rel: "noopener noreferrer",
                                children: tunnelStatus.accessUrl,
                              }),
                              react_jsx_runtime.jsx("div", {
                                style: { display: "flex", gap: "8px", flexWrap: "wrap" },
                                children: [
                                  react_jsx_runtime.jsx("a", {
                                    className: "dshmh-link",
                                    href: tunnelStatus.accessUrl,
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    children: t.openLink,
                                  }),
                                  react_jsx_runtime.jsx("button", {
                                    className: "dshmh-link",
                                    type: "button",
                                    style: { background: "none", border: "none", cursor: "pointer", padding: 0 },
                                    onClick: copyLink,
                                    children: copied ? t.copied : t.copy,
                                  }),
                                  react_jsx_runtime.jsx("button", {
                                    className: "dshmh-btn dshmh-save",
                                    type: "button",
                                    onClick: regenerate,
                                    disabled: regenerating,
                                    children: regenerating ? t.regenerating : t.regenerate,
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      })
                    : null,
                  react_jsx_runtime.jsx("div", {
                    className: "dshmh-field",
                    children: [
                      react_jsx_runtime.jsx("span", { className: "dshmh-label", children: t.target }),
                      react_jsx_runtime.jsx("input", {
                        className: "dshmh-input",
                        value: targetValue,
                        placeholder: autoTarget || "http://127.0.0.1:3080",
                        disabled: saving,
                        onChange: (e) => { setTarget(e.target.value); setDirty(true); },
                      }),
                    ],
                  }),
                  react_jsx_runtime.jsx("div", {
                    className: "dshmh-field",
                    children: [
                      react_jsx_runtime.jsx("span", { className: "dshmh-label", children: t.cloudflaredPath }),
                      react_jsx_runtime.jsx("input", {
                        className: "dshmh-input",
                        value: cloudflaredPath,
                        disabled: saving,
                        onChange: (e) => { setCloudflaredPath(e.target.value); setDirty(true); },
                      }),
                    ],
                  }),
                  react_jsx_runtime.jsx("label", {
                    className: "dshmh-check",
                    children: [
                      react_jsx_runtime.jsx("input", {
                        type: "checkbox",
                        checked: sessionHandoff,
                        disabled: saving,
                        onChange: (e) => { setSessionHandoff(e.target.checked); setDirty(true); },
                      }),
                      t.sessionHandoff,
                    ],
                  }),
                  react_jsx_runtime.jsx("div", {
                    className: "dshmh-field",
                    children: [
                      react_jsx_runtime.jsx("span", { className: "dshmh-label", children: t.pluginUpdate }),
                      react_jsx_runtime.jsx("div", {
                        style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
                        children: [
                          updateStatus.state === "idle"
                            ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: updateStatus.currentVersion ? "v" + updateStatus.currentVersion : "" })
                            : updateStatus.state === "checking"
                              ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: t.checkingUpdate })
                              : updateStatus.state === "available"
                                ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: "v" + updateStatus.currentVersion + " → v" + updateStatus.latestVersion })
                                : updateStatus.state === "up-to-date"
                                  ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: t.upToDate + (updateStatus.currentVersion ? " (v" + updateStatus.currentVersion + ")" : "") })
                                  : updateStatus.state === "updating"
                                    ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: t.updating })
                                    : updateStatus.state === "updated"
                                      ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: updateStatus.migration ? t.migrated : t.updated })
                                      : updateStatus.state === "failed"
                                        ? react_jsx_runtime.jsx("span", { className: "dshmh-failed", children: (updateStatus.error ? t.updateFailed + ": " + updateStatus.error : t.updateFailed) })
                                        : updateStatus.state === "available" && updateStatus.migration
                                          ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: t.renamedTo + (updateStatus.currentVersion ? " v" + updateStatus.currentVersion + " → v" + updateStatus.latestVersion : "") })
                                          : react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: updateStatus.currentVersion ? "v" + updateStatus.currentVersion : "" }),
                          updateStatus.state === "available"
                            ? react_jsx_runtime.jsx("div", {
                                style: { display: "flex", gap: "8px", alignItems: "center" },
                                children: [
                                  react_jsx_runtime.jsx("button", {
                                    className: "dshmh-btn dshmh-save",
                                    type: "button",
                                    onClick: doUpdate,
                                    disabled: updating || checking,
                                    children: updateStatus.migration ? t.migrate : t.updateAvailable,
                                  }),
                                  updateStatus.migration
                                    ? react_jsx_runtime.jsx("a", {
                                        className: "dshmh-link",
                                        href: updateStatus.targetUrl || "https://www.npmjs.com/package/dsh-remote-tunnel-easy",
                                        target: "_blank",
                                        rel: "noreferrer",
                                        children: t.viewNewPackage,
                                      })
                                    : null,
                                ],
                              })
                            : updateStatus.state === "up-to-date" || updateStatus.state === "idle"
                              ? react_jsx_runtime.jsx("button", {
                                  className: "dshmh-btn dshmh-save",
                                  type: "button",
                                  onClick: doCheckUpdate,
                                  disabled: checking || updating,
                                  children: checking ? t.checkingUpdate : t.checkUpdate,
                                })
                              : updateStatus.state === "failed"
                                ? react_jsx_runtime.jsx("button", {
                                    className: "dshmh-btn dshmh-save",
                                    type: "button",
                                    onClick: doCheckUpdate,
                                    disabled: checking || updating,
                                    children: t.checkUpdate,
                                  })
                                : updateStatus.state === "updated"
                                  ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: t.restartRequired })
                                  : updateStatus.state === "checking" || updateStatus.state === "updating"
                                    ? null
                                    : react_jsx_runtime.jsx("button", {
                                        className: "dshmh-btn dshmh-save",
                                        type: "button",
                                        onClick: doCheckUpdate,
                                        disabled: checking || updating,
                                        children: t.checkUpdate,
                                      }),
                        ],
                      }),
                      updateStatus.requiresRestart
                        ? react_jsx_runtime.jsx("span", { className: "dshmh-hint", children: t.restartRequired })
                        : null,
                    ],
                  }),
                  react_jsx_runtime.jsx("div", {
                    className: "dshmh-footer",
                    children: [
                      failed ? react_jsx_runtime.jsx("span", { className: "dshmh-failed", children: t.saveFailed }) : null,
                      react_jsx_runtime.jsx("button", {
                        className: "dshmh-btn dshmh-save",
                        type: "button",
                        onClick: save,
                        disabled: saving || !dirty,
                        children: saving ? t.saving : t.save,
                      }),
                    ],
                  }),
                ],
              })
            : null,
        ],
      });
    }

    const inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("settings.plugin.item", () =>
        ctx.slots.register(
          {
            name: "settings.plugin.item",
            key: "remote-handoff",
            id: "dsh-remote-tunnel-easy",
            order: 130,
            inject: () => ({}),
          },
          RemoteHandoffCard
        )
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
