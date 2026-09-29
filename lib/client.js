window.__ModuleLoader__.load({
	id: "dsh-connect-qoder-x",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/status-paths.ts
		/** Plugin-owned status endpoint consumed by its browser half. */
		const QODER_STATUS_PATH = "/plugins/dsh-connect-qoder-x/status";
		/**
		* Plugin-owned probe control endpoint.
		*
		* Separate from the status route because it accepts writes: the status route's
		* loopback Host/Origin guard protects against a DNS-rebinding *page*, which is
		* not the same as authorizing a state-changing action. This route therefore
		* also requires the in-process key the browser half receives with the status
		* document.
		*/
		const QODER_PROBE_PATH = "/plugins/dsh-connect-qoder-x/probe";
		/**
		* Plugin-owned PAT endpoint, one per variant.
		*
		* A POST here saves (validates and persists) a Personal Access Token, or
		* clears the stored one. Unlike the read-only status GET it is a write —
		* it persists a credential — so it also requires the in-process key the
		* browser half receives with the status document.
		*/
		const QODER_AUTH_PATH = "/plugins/dsh-connect-qoder-x/auth";
		/**
		* The international (Qoder Global) variant's own triple of routes.
		*
		* Kept as separate constants rather than a computed suffix so both halves
		* reference literal strings: the browser bundle and the host bundle are built
		* independently, and a shared expression is one build-config drift away from
		* the desk asking a route the host never mounted.
		*/
		const QODER_GLOBAL_STATUS_PATH = "/plugins/dsh-connect-qoder-x/global/status";
		const QODER_GLOBAL_PROBE_PATH = "/plugins/dsh-connect-qoder-x/global/probe";
		const QODER_GLOBAL_AUTH_PATH = "/plugins/dsh-connect-qoder-x/global/auth";
		//#endregion
		//#region src/client/status-document.ts
		/**
		* Whether a parsed status response really is a status document.
		*
		* A 200 is not a promise about the body: it may be empty, literal `null`, a
		* non-JSON page from a proxy, or an array. Both halves of the browser plugin
		* read the same route, so both must agree on what is valid — storing an
		* unreadable value puts something in state that the next render dereferences.
		*
		* The check is deliberately limited to the discriminator (plus `error`'s
		* `message`, which the error paragraph renders): validating optional fields
		* here would reject documents the host legitimately omits fields from.
		*/
		function isQoderWebStatus(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const wrapped = value;
			const status = wrapped["status"];
			if (status === "signed-out" || status === "signed-in") return true;
			return status === "error" && typeof wrapped["message"] === "string";
		}
		//#endregion
		//#region src/client/quota-settings-store.ts
		let pollIntervalMs = 3e5;
		const toggles = {
			cn: false,
			global: false
		};
		let togglesSnapshot = {
			cn: false,
			global: false
		};
		const signIn = {
			cn: false,
			global: false
		};
		let signInSnapshot = {
			cn: false,
			global: false
		};
		let revision = 0;
		const listeners = /* @__PURE__ */ new Set();
		function bump() {
			revision += 1;
			for (const listener of listeners) listener();
		}
		/** Update the shared poll interval (from the settings document). */
		function setQuotaPollMs(ms) {
			if (Number.isFinite(ms) && ms >= 6e4 && pollIntervalMs !== ms) {
				pollIntervalMs = ms;
				bump();
			}
		}
		/** Read the configured poll interval. */
		function quotaPollMs() {
			return pollIntervalMs;
		}
		/** Update both sidebar toggles (from the settings document). */
		function setQuotaToggles(cn, global) {
			if (toggles.cn !== cn || toggles.global !== global) {
				toggles.cn = cn;
				toggles.global = global;
				togglesSnapshot = { ...toggles };
				bump();
			}
		}
		/** Read the current toggles. */
		function quotaToggles() {
			return togglesSnapshot;
		}
		/** Record a variant's sign-in state from any successful status poll. */
		function noteQuotaSignIn(variantId, signedIn) {
			if (variantId === "qoder" && signIn.cn !== signedIn) {
				signIn.cn = signedIn;
				signInSnapshot = { ...signIn };
				bump();
			} else if (variantId === "qoder-global" && signIn.global !== signedIn) {
				signIn.global = signedIn;
				signInSnapshot = { ...signIn };
				bump();
			}
		}
		/** Read the cached sign-in state. */
		function quotaSignInState() {
			return signInSnapshot;
		}
		/** Subscribe to any flag change; returns the disposer. */
		function onQuotaSettingsChange(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/** The current revision — the useSyncExternalStore snapshot value. */
		function quotaSettingsRevision() {
			return revision;
		}
		/** Which variant a status route belongs to, from the route path. */
		function variantOfStatusPath(statusPath) {
			return statusPath.includes("/global/") ? "qoder-global" : "qoder";
		}
		/**
		* The last status document per variant, shared by EVERY quota surface.
		*
		* The sidebar cards and the dashboard each used to fetch independently, so a
		* dashboard refresh updated the panel while the sidebar card kept showing its
		* previous read until its own next tick — two different numbers for one
		* account on one screen. One store, one write path
		* ({@link noteQuotaStatus}), and every subscriber re-renders through the
		* same revision: whatever surface refreshed last, all of them show it.
		*
		* Documents are kept by identity (never mutated), so reference comparisons
		* in useSyncExternalStore selectors stay cheap and stable.
		*/
		const statusDocuments = {
			cn: void 0,
			global: void 0
		};
		/**
		* Publish one variant's freshly fetched status document. Downstream
		* subscribers (both sidebar cards and the dashboard, through whichever
		* observable wraps this store) re-render on the revision bump.
		*/
		function noteQuotaStatus(variantId, status) {
			if (variantId === "qoder" && statusDocuments.cn !== status) {
				statusDocuments.cn = status;
				statusFetchedAt.cn = Date.now();
				bump();
			} else if (variantId === "qoder-global" && statusDocuments.global !== status) {
				statusDocuments.global = status;
				statusFetchedAt.global = Date.now();
				bump();
			}
			noteQuotaSignIn(variantId, status.status === "signed-in");
		}
		/** Read one variant's latest status document. */
		function quotaStatus(variantId) {
			return variantId === "qoder" ? statusDocuments.cn : statusDocuments.global;
		}
		/** When each variant's document was last fetched (per publish, not per read). */
		const statusFetchedAt = {
			cn: void 0,
			global: void 0
		};
		/** Read the time a variant's current document was fetched, if any. */
		function quotaStatusFetchedAt(variantId) {
			return variantId === "qoder" ? statusFetchedAt.cn : statusFetchedAt.global;
		}
		/**
		* Whether ONE variant's shared document is fresh enough to skip a fetch:
		* the user's rule — a click/mount/interval tick within the configured
		* interval of the last successful read reuses the cached document, and only
		* a variant with NO result yet (or a failed read that never landed one)
		* forces the upstream call. The interval is a cache lifetime, not a metronome.
		*
		* A `maxAgeMs` of the poll interval comes from the settings document; a
		* failed last read is NOT tracked here (callers gate failures themselves),
		* because "the last read failed" still means "no usable result".
		*
		* @param variantId - which variant's freshness to test.
		* @param maxAgeMs - the configured poll interval (cache lifetime).
		*/
		function quotaStatusIsFresh(variantId, maxAgeMs) {
			const fetchedAt = variantId === "qoder" ? statusFetchedAt.cn : statusFetchedAt.global;
			const document = variantId === "qoder" ? statusDocuments.cn : statusDocuments.global;
			if (fetchedAt === void 0 || document === void 0) return false;
			return Date.now() - fetchedAt < maxAgeMs;
		}
		//#endregion
		//#region src/client/QuotaSettingsCard.tsx
		/**
		* The shared quota-settings card: one card above the two variant cards that
		* configures both sidebar quota widgets.
		*
		* Like the built-in plugin cards, it registers into the Plugins tab's card
		* list — `settings.plugin.item` on DSH 0.1.5, the shared 《插件设置》 block on
		* 0.1.7, where that list is gone — and writes through the settings face's
		* revision-fenced `set` — the same durable-write path every preference row
		* uses. A toggle commits on click: each click is one explicit user choice,
		* and the scope's ordering makes the last one win, so no staged-draft form is
		* needed for two booleans and a number.
		*
		* The two toggles gate the CN and international sidebar cards respectively;
		* the interval is one shared poll period. Toggles are disabled while their
		* variant is signed out: a quota card for an account nobody is signed into
		* would render an error forever, so the setting waits for a session.
		*/
		/** The default poll interval shown before a value is stored. */
		const POLL_DEFAULT_MS = 3e5;
		/** Floor the schema also enforces; mirrored here for immediate UI feedback. */
		const POLL_MIN_MS = 6e4;
		/** 10:00 UTC+8, the moment the upstream resets the daily campaign. */
		const CHECK_IN_MINUTE_DEFAULT = 600;
		/** Minutes past midnight (UTC+8), split for the two number fields. */
		function splitMinutes(minutes) {
			const safe = Number.isFinite(minutes) ? Math.trunc(minutes) : CHECK_IN_MINUTE_DEFAULT;
			const clamped = safe < 0 || safe > 1439 ? CHECK_IN_MINUTE_DEFAULT : safe;
			return {
				hours: Math.floor(clamped / 60),
				minutes: clamped % 60
			};
		}
		/** Read the section values out of a scope snapshot (defaults when absent). */
		function project(scope) {
			if (scope === void 0) return {
				status: "unavailable",
				writable: false,
				values: {
					sidebarQuotaCN: false,
					sidebarQuotaGlobal: false,
					autoCheckInCN: false,
					autoCheckInGlobal: false,
					checkInMinuteCN: CHECK_IN_MINUTE_DEFAULT,
					checkInMinuteGlobal: CHECK_IN_MINUTE_DEFAULT,
					quotaPollMs: POLL_DEFAULT_MS
				}
			};
			const snapshot = scope.getSnapshot();
			const value = snapshot.value ?? {};
			return {
				status: snapshot.status,
				writable: snapshot.writable,
				values: {
					sidebarQuotaCN: value.sidebarQuotaCN === true,
					sidebarQuotaGlobal: value.sidebarQuotaGlobal === true,
					autoCheckInCN: value.autoCheckInCN === true,
					autoCheckInGlobal: value.autoCheckInGlobal === true,
					checkInMinuteCN: typeof value.checkInMinuteCN === "number" ? value.checkInMinuteCN : CHECK_IN_MINUTE_DEFAULT,
					checkInMinuteGlobal: typeof value.checkInMinuteGlobal === "number" ? value.checkInMinuteGlobal : CHECK_IN_MINUTE_DEFAULT,
					quotaPollMs: typeof value.quotaPollMs === "number" ? value.quotaPollMs : POLL_DEFAULT_MS
				}
			};
		}
		/**
		* Stable-reference projection cache.
		*
		* React's useSyncExternalStore requires getSnapshot() to return THE SAME
		* reference between renders unless the store actually changed. project()
		* builds a fresh object every call, which re-renders forever and crashes the
		* card with React error #185 ("maximum update depth exceeded") — exactly the
		* crash the slot ledger reported. The cache below returns the last built
		* projection until the underlying scope snapshot (or scope identity) changes,
		* which is the only thing the projection actually derives from.
		*/
		let cachedScope;
		let cachedProjection;
		const UNAVAILABLE = {
			status: "unavailable",
			writable: false,
			values: {
				sidebarQuotaCN: false,
				sidebarQuotaGlobal: false,
				autoCheckInCN: false,
				autoCheckInGlobal: false,
				checkInMinuteCN: CHECK_IN_MINUTE_DEFAULT,
				checkInMinuteGlobal: CHECK_IN_MINUTE_DEFAULT,
				quotaPollMs: POLL_DEFAULT_MS
			}
		};
		function stableProject(scope) {
			if (scope === void 0) return UNAVAILABLE;
			const next = project(scope);
			if (cachedProjection === void 0 || cachedScope !== scope || cachedProjection.status !== next.status || cachedProjection.writable !== next.writable || cachedProjection.values.sidebarQuotaCN !== next.values.sidebarQuotaCN || cachedProjection.values.sidebarQuotaGlobal !== next.values.sidebarQuotaGlobal || cachedProjection.values.autoCheckInCN !== next.values.autoCheckInCN || cachedProjection.values.autoCheckInGlobal !== next.values.autoCheckInGlobal || cachedProjection.values.checkInMinuteCN !== next.values.checkInMinuteCN || cachedProjection.values.checkInMinuteGlobal !== next.values.checkInMinuteGlobal || cachedProjection.values.quotaPollMs !== next.values.quotaPollMs) {
				cachedScope = scope;
				cachedProjection = next;
			}
			return cachedProjection;
		}
		/** One toggle row: label, hint, and a switch drawn to the shell's proportions. */
		function ToggleRow({ label, hint, checked, disabled, disabledHint, onToggle }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowTextStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle$1,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: disabled === true && disabledHint !== void 0 ? disabledHint : hint
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "switch",
					"aria-checked": checked,
					disabled,
					"aria-label": label,
					onClick: () => {
						if (disabled) return;
						onToggle(!checked);
					},
					style: {
						...switchStyle,
						background: checked ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.2))",
						justifyContent: checked ? "flex-end" : "flex-start",
						opacity: disabled === true ? .45 : 1,
						cursor: disabled === true ? "not-allowed" : "pointer"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: knobStyle })
				})]
			});
		}
		/**
		* One time row: the moment a variant checks in, as two typeable number fields.
		*
		* Deliberately NOT `<input type="time">`: that control's segments are spinners,
		* and with an IME active (every Chinese/Japanese keyboard) the segments refuse
		* typed digits, leaving only the tiny stepper arrows — unusable for the one
		* thing this row exists to do. Two plain number fields accept typing under any
		* input method; the value is committed on blur or Enter, so a half-typed
		* field never writes a wrong moment to the host.
		*/
		function TimeRow({ label, hint, value, disabled, onPick }) {
			const split = splitMinutes(value);
			const [hourDraft, setHourDraft] = (0, react.useState)(String(split.hours));
			const [minuteDraft, setMinuteDraft] = (0, react.useState)(String(split.minutes).padStart(2, "0"));
			(0, react.useEffect)(() => {
				const next = splitMinutes(value);
				setHourDraft(String(next.hours));
				setMinuteDraft(String(next.minutes).padStart(2, "0"));
			}, [value]);
			const commit = () => {
				const parsedHours = Number.parseInt(hourDraft, 10);
				const parsedMinutes = Number.parseInt(minuteDraft, 10);
				const hours = Number.isFinite(parsedHours) ? Math.min(23, Math.max(0, parsedHours)) : split.hours;
				const minutes = Number.isFinite(parsedMinutes) ? Math.min(59, Math.max(0, parsedMinutes)) : split.minutes;
				const next = hours * 60 + minutes;
				if (next === value) {
					setHourDraft(String(hours));
					setMinuteDraft(String(minutes).padStart(2, "0"));
					return;
				}
				onPick(next);
			};
			const onKeyDown = (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowTextStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle$1,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: hint
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: pollFieldStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 0,
							max: 23,
							value: hourDraft,
							disabled,
							"aria-label": `${label} — hour`,
							"data-checkin-part": "hour",
							onChange: (event) => {
								setHourDraft(event.target.value);
							},
							onBlur: commit,
							onKeyDown,
							style: {
								...timePartStyle,
								opacity: disabled === true ? .45 : 1
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: labelStyle$1,
							children: ":"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 0,
							max: 59,
							value: minuteDraft,
							disabled,
							"aria-label": `${label} — minute`,
							"data-checkin-part": "minute",
							onChange: (event) => {
								setMinuteDraft(event.target.value);
							},
							onBlur: commit,
							onKeyDown,
							style: {
								...timePartStyle,
								opacity: disabled === true ? .45 : 1
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: hintStyle,
							children: "UTC+8"
						})
					]
				})]
			});
		}
		/** The inner controls for sidebar quota settings. */
		function QuotaSettingsContent({ t = (key) => key, scope, signedIn, variant }) {
			const subscribe = (0, react.useCallback)((onStoreChange) => {
				return scope?.subscribe(onStoreChange) ?? (() => {});
			}, [scope]);
			const projection = (0, react.useSyncExternalStore)(subscribe, () => stableProject(scope));
			const liveSignIn = (0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSignInState);
			const [probe, setProbe] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let disposed = false;
				const probeOne = async (path) => {
					try {
						const body = await (await fetch(path, { headers: { accept: "application/json" } })).json();
						if (disposed || !isQoderWebStatus(body)) return void 0;
						noteQuotaSignIn(variantOfStatusPath(path), body.status === "signed-in");
						return body.status === "signed-in";
					} catch {
						return;
					}
				};
				(async () => {
					const [cn, global] = variant === "cn" ? [await probeOne(QODER_STATUS_PATH), void 0] : variant === "global" ? [void 0, await probeOne(QODER_GLOBAL_STATUS_PATH)] : await Promise.all([probeOne(QODER_STATUS_PATH), probeOne(QODER_GLOBAL_STATUS_PATH)]);
					if (!disposed) setProbe({
						cn: cn === true,
						global: global === true
					});
				})();
				return () => {
					disposed = true;
				};
			}, []);
			if (projection.status === "unavailable") return null;
			const reported = signedIn?.();
			const deriveSigned = (variant, variantId) => {
				if (reported !== void 0) return Boolean(reported[variant]);
				const currentStatus = quotaStatus(variantId);
				if (currentStatus?.status === "signed-out") return false;
				const live = liveSignIn[variant];
				if (probe !== void 0) {
					if (!probe[variant]) return Boolean(live && currentStatus?.status === "signed-in");
					return Boolean(live);
				}
				return Boolean(live && currentStatus?.status === "signed-in");
			};
			const signed = {
				cn: deriveSigned("cn", "qoder"),
				global: deriveSigned("global", "qoder-global")
			};
			const write = (field, value) => {
				if (field === "sidebarQuotaCN" && value === true && !signed.cn) return;
				if (field === "sidebarQuotaGlobal" && value === true && !signed.global) return;
				if (field === "autoCheckInCN" && value === true && !signed.cn) return;
				if (field === "autoCheckInGlobal" && value === true && !signed.global) return;
				scope?.set(field, value);
			};
			const minutes = Math.max(POLL_MIN_MS / 6e4, Math.round(projection.values.quotaPollMs / 6e4));
			const showCN = variant === void 0 || variant === "cn";
			const showGlobal = variant === void 0 || variant === "global";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 4
				},
				children: [
					showCN ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("quotaToggleCN"),
						hint: t("quotaToggleHint"),
						checked: projection.values.sidebarQuotaCN,
						disabled: !signed.cn,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("sidebarQuotaCN", next)
					}) : null,
					showGlobal ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("quotaToggleGlobal"),
						hint: t("quotaToggleHint"),
						checked: projection.values.sidebarQuotaGlobal,
						disabled: !signed.global,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("sidebarQuotaGlobal", next)
					}) : null,
					showCN ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("autoCheckInCN"),
						hint: t("autoCheckInHintCN"),
						checked: projection.values.autoCheckInCN,
						disabled: !signed.cn,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("autoCheckInCN", next)
					}) : null,
					showCN ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("checkInTimeCN"),
						hint: t("checkInTimeHint"),
						value: projection.values.checkInMinuteCN,
						disabled: !signed.cn,
						onPick: (next) => write("checkInMinuteCN", next)
					}) : null,
					showGlobal ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("autoCheckInGlobal"),
						hint: t("autoCheckInHintGlobal"),
						checked: projection.values.autoCheckInGlobal,
						disabled: !signed.global,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("autoCheckInGlobal", next)
					}) : null,
					showGlobal ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("checkInTimeGlobal"),
						hint: t("checkInTimeHint"),
						value: projection.values.checkInMinuteGlobal,
						disabled: !signed.global,
						onPick: (next) => write("checkInMinuteGlobal", next)
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							...rowStyle,
							borderBottom: "none",
							paddingBottom: 0
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowTextStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: labelStyle$1,
								children: t("quotaPollLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: hintStyle,
								children: t("quotaPollHint")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: pollFieldStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: POLL_MIN_MS / 6e4,
								step: 1,
								value: minutes,
								"aria-label": t("quotaPollLabel"),
								onChange: (event) => {
									const mins = Number.parseInt(event.target.value, 10);
									if (Number.isFinite(mins) && mins > 0) write("quotaPollMs", Math.max(POLL_MIN_MS, mins * 6e4));
								},
								style: inputStyle
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: hintStyle,
								children: t("quotaPollUnit")
							})]
						})]
					}),
					projection.writable === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: t("quotaSettingsSaveFailed")
					}) : null
				]
			});
		}
		/**
		* One settings row: NO box of its own (the bordered rows read as nested
		* cards, which the user ruled against) — rows are separated by a hairline
		* bottom rule like the settings shell's own preference lists.
		*/
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			gap: 12,
			borderBottom: ".5px solid var(--dsw-alias-border-l2)",
			paddingBottom: 10
		};
		const rowTextStyle = {
			display: "flex",
			flex: 1,
			minWidth: 0,
			flexDirection: "column",
			gap: 2
		};
		const labelStyle$1 = {
			fontSize: 13,
			fontWeight: 500,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-primary)"
		};
		const hintStyle = {
			fontSize: 12,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const switchStyle = {
			flex: "none",
			display: "flex",
			width: 36,
			height: 20,
			borderRadius: 10,
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2)",
			padding: 1,
			cursor: "pointer",
			alignItems: "center",
			transition: "background .16s"
		};
		const knobStyle = {
			display: "block",
			width: 16,
			height: 16,
			borderRadius: "50%",
			background: "var(--dsw-alias-bg-layer-1, #fff)",
			boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
		};
		const pollFieldStyle = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			flex: "none"
		};
		const timePartStyle = {
			boxSizing: "border-box",
			width: 56,
			padding: "5px 8px",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			textAlign: "center"
		};
		const inputStyle = {
			boxSizing: "border-box",
			width: 55,
			padding: "5px 8px",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			textAlign: "right"
		};
		//#endregion
		//#region src/client/QoderPluginCard.tsx
		/** Qoder status card contributed to Harness Plugin configuration. */
		const QODER_PLUGIN_ICON = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxIiB5PSIxIiB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHJ4PSI4IiBmaWxsPSJ1cmwoI2cpIiAvPjxwYXRoIGQ9Ik0xOS42IDcuNSAxMSAyMGg1LjZsLTEuNCA4LjVMMjQuNSAxNmgtNS42bC43LTguNVoiIGZpbGw9IiNGRkZGRkYiLz48Y2lyY2xlIGN4PSIyNS41IiBjeT0iMjUuNSIgcj0iMy4yIiBmaWxsPSIjNDVEOUU3Ii8+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMTgiIHkxPSIxIiB4Mj0iMTgiIHkyPSIzNSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIHN0b3AtY29sb3I9IiM3Q0I3RkYiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMxNDVBRjMiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48L3N2Zz4=";
		/** China Qoder; the plugin's primary card and default. */
		const QODER_CN_CARD = {
			id: "qoder",
			titleKey: "title",
			introKey: "intro",
			signedOutKey: "signedOutHint",
			patGuideKey: "patGuide",
			patPlaceholderKey: "patPlaceholder",
			statusPath: QODER_STATUS_PATH,
			probePath: QODER_PROBE_PATH,
			authPath: QODER_AUTH_PATH
		};
		/** International Qoder Global. */
		const QODER_GLOBAL_CARD = {
			id: "qoder-global",
			titleKey: "titleAI",
			introKey: "introAI",
			signedOutKey: "signedOutHintAI",
			patGuideKey: "patGuideAI",
			patPlaceholderKey: "patPlaceholderAI",
			statusPath: QODER_GLOBAL_STATUS_PATH,
			probePath: QODER_GLOBAL_PROBE_PATH,
			authPath: QODER_GLOBAL_AUTH_PATH
		};
		/** Both cards, in display order (China first). */
		const QODER_CARD_VARIANTS = [QODER_CN_CARD, QODER_GLOBAL_CARD];
		const POLL_INTERVAL_MS = 6e4;
		/** Hover, matching the built-in card's `:hover`. Inline styles cannot express a pseudo-class. */
		/**
		* The page face: the card is no longer collapsible, so it renders in the "open"
		* treatment unconditionally — the tone the built-in card used while expanded.
		*/
		/**
		* The page body's inner separator. The card is now the whole page, so this rule
		* sits at the top of the body rather than under a disclosure header.
		*/
		/** The built-in secondary button: transparent, hairline border, 8px radius. */
		/**
		* The PAT entry row: the password field takes the row's flexible width, the
		* Save button keeps its own, and the whole block sits inside the card body
		* without a nested box (the same rule the settings rows follow).
		*/
		/**
		* Primary action of the inline confirmation and of the PAT save. Fill and text
		* colour come from the theme as a pair: `brand-primary` is a light accent here,
		* so pairing it with a hardcoded white would render white-on-white.
		*/
		/**
		* The destructive action's tone: solid error fill while confirmed, and a
		* quiet outline before that. Both derive from the error token pair so the
		* theme stays the single source of the colour.
		*/
		function progressFillStyle(percent) {
			return {
				width: `${Math.max(0, Math.min(100, percent))}%`,
				height: "100%",
				borderRadius: "inherit",
				background: "var(--dsw-alias-brand-primary, #1677ff)"
			};
		}
		/**
		* Status dot colour. Takes `'loading'` as well as the document's own states:
		* before the first response the card knows nothing about the account, so it must
		* not borrow the signed-out grey — that would read as "nothing is wrong, nobody
		* is signed in" when the truth is "not read yet".
		*/
		function dotStyle(status) {
			return {
				width: 8,
				height: 8,
				borderRadius: "50%",
				flex: "0 0 auto",
				background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" ? "var(--dsw-alias-state-error-primary, #d92d20)" : "var(--dsw-alias-label-dimmed, #8c8c8c)"
			};
		}
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0).format(value);
		}
		function formatPercent(value) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value);
		}
		/** Date-only formatting for expiries: the day is what a validity window means. */
		function formatDate(ms) {
			return new Intl.DateTimeFormat(void 0, { dateStyle: "medium" }).format(new Date(ms));
		}
		function formatTime(ms) {
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(new Date(ms));
		}
		function formatCycleReset(time) {
			const parsed = Date.parse(time);
			if (!Number.isNaN(parsed)) return formatTime(parsed);
			return time;
		}
		function patSourceText(source, t) {
			if (source === "env") return t("patSourceEnv");
			if (source === "cli") return t("patSourceCli");
			return t("patSourceCard");
		}
		/**
		* One billing package as a labeled progress bar.
		*
		* A package whose allowance the upstream never reported (`size` not positive)
		* has no percentage to state. It must not fall back to 100%: the plugin would be
		* claiming a full quota it knows nothing about, which is the opposite of the
		* honest "remaining N" line printed below it. Unknown size therefore renders the
		* percent slot as unknown copy and an unfilled, indeterminate track.
		*/
		function CreditBar({ label, remain, size, unlimited, packageEndTime, t }) {
			const expiry = packageEndTime === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "qdp-rate",
				children: [
					t("quotaExpires"),
					" ",
					formatCycleReset(packageEndTime)
				]
			});
			if (unlimited === true) {
				const quotaText = t("unlimitedQuota");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qdp-group",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qdp-label",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quotaText })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "qdp-track",
							role: "progressbar",
							"aria-label": label,
							"aria-valuetext": quotaText
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "qdp-body",
							children: quotaText
						}),
						expiry
					]
				});
			}
			const sizeKnown = size > 0;
			const detail = sizeKnown ? t("exactRemaining", {
				remain: formatNumber(remain),
				size: formatNumber(size)
			}) : t("creditPackageUnknownSize", { remain: formatNumber(remain) });
			const percent = sizeKnown ? remain / size * 100 : void 0;
			const display = percent === void 0 ? t("percentUnknown") : t("percentRemaining", { percent: formatPercent(percent) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qdp-group",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qdp-label",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: display })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "qdp-track",
						role: "progressbar",
						"aria-label": label,
						...percent === void 0 ? { "aria-valuetext": detail } : {
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-valuenow": percent
						},
						children: percent === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: progressFillStyle(percent) })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-body",
						children: detail
					}),
					expiry
				]
			});
		}
		/**
		* Context capacity, listed in full.
		*
		* Every model the upstream reports a capacity for, largest first. A one-line
		* summary with the exceptions on hover was tried and rejected: capacity is
		* reference data you scan by model, and hiding most of it behind a hover made
		* the common case (a model you already have in mind) the hard one to look up.
		*
		* Purely a report of the upstream's own numbers — the middle alternatives the
		* upstream lists between the default and the maximum are display-only (the
		* upstream honours the default and the maximum, nothing between), so the only
		* control is the maximum-window preference below, which flips every eligible
		* model between its default and its largest declared window.
		*/
		function formatTokens(tokens) {
			if (tokens >= 1e6 && tokens % 1e6 === 0) return `${tokens / 1e6}M`;
			if (tokens >= 1e3 && tokens % 1e3 === 0) return `${tokens / 1e3}K`;
			return String(tokens);
		}
		/**
		* Model visibility table with individual toggle switches and batch enable/disable controls.
		*/
		/**
		* 「用量与签到」面板:上半是剩余积分(周期汇总 + 各资源包进度条),分隔线下
		* 是签到状态与动作(立即签到 / 刷新 / 展开日志 / 清除),签到状态直接印在
		* 行内。workbuddy credit-panel 的结构,按本插件的信息密度重排。
		*/
		function UsageCheckInPanel({ credits, creditsError, checkIn, t, busy, checkingIn, checkInNotice, autoCheckIn, onCheckIn }) {
			/** Today's claim already happened (the upstream said so, or the log does). */
			const claimedToday = checkIn !== void 0 && checkIn.status === "claimed";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [creditsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "qdp-error",
				children: t("creditsError", { message: creditsError })
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qdp-twoUp",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CheckInLedger, {
					logs: checkIn?.logs,
					t
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qdp-panel",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "qdp-panelHead",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "qdp-panelTitle",
								children: t("creditsHeading")
							})
						}),
						credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							credits.cycleResetTime === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "qdp-panelMeta",
								children: t("cycleResetAt", { time: formatCycleReset(credits.cycleResetTime) })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "qdp-panelMeta",
								children: Number.isFinite(credits.total) ? t("creditsUsed", { percent: formatPercent(credits.total) }) : credits.unlimited === true ? t("creditsUsedUnlimited") : t("creditsNoData")
							}),
							credits.accounts.filter((account) => account.remain > 0 || account.unlimited === true).map((account, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreditBar, {
								label: account.packageName,
								remain: account.remain,
								size: account.size,
								unlimited: account.unlimited,
								packageEndTime: account.packageEndTime,
								t
							}, `${account.packageName}-${String(index)}`))
						] }),
						autoCheckIn !== true || checkIn?.nextRunAt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "qdp-panelMeta",
							children: t("checkInNextRun", { time: formatTime(checkIn.nextRunAt) })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: claimedToday ? "qdp-btn qdp-claimBtn" : "qdp-btn qdp-btnPrimary qdp-claimBtn",
							disabled: busy || checkingIn || claimedToday,
							onClick: onCheckIn,
							children: checkingIn ? t("checkInChecking") : claimedToday ? t("checkInClaimedToday") : t("checkInNow")
						}),
						checkInNotice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "qdp-body",
							children: checkInNotice
						})
					]
				})]
			})] });
		}
		/**
		* 「3 天内到期」的统计窗口。30 天有效期的包还剩 20 天才到期,不该出现在
		* 「3 天内到期」里 —— 这里统计的是窗口内真的会作废的笔,不是「所有还没过期的」。
		* workbuddy 的「最近 3 天到期」就是这个读法。
		*/
		const SOON_WINDOW_MS = 2592e5;
		/**
		* 最近的签到记录(BOX):插件内每次签到领取到的资源包、数量与到期时间。
		*
		* 这是原来「签到日志」表格的替代:表格只能证明「点过按钮」,而这里回答的是
		* 用户真正关心的问题 —— 我手上有哪些还没过期的资源包,各自什么时候作废。
		* 因此按「领取时间」倒序列出,并在每行右侧给出该笔的到期日(上游未给有效期
		* 时显示未知,不猜)。
		*/
		function CheckInLedger({ logs, t }) {
			const now = Date.now();
			const claimed = (logs ?? []).filter((entry) => entry.status === "claimed" || entry.status === "already-claimed").sort((a, b) => b.timestamp - a.timestamp);
			const expiringSoonTotal = claimed.filter((entry) => entry.expiresAtMs !== void 0 && entry.expiresAtMs > now && entry.expiresAtMs <= now + SOON_WINDOW_MS).reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qdp-panel",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "qdp-panelHead",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "qdp-panelTitle",
							children: t("ledgerHeading")
						})
					}),
					claimed.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-panelMeta",
						children: t("ledgerEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "qdp-logList qdp-ledgerList",
						children: claimed.map((entry) => {
							const expired = entry.expiresAtMs !== void 0 && entry.expiresAtMs <= now;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qdp-ledgerRow",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qdp-ledgerDate",
										children: formatTime(entry.timestamp)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qdp-ledgerAmount",
										children: entry.amount === void 0 ? "—" : `+${entry.amount}`
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: expired ? "qdp-ledgerExpiry qdp-ledgerExpired" : "qdp-ledgerExpiry",
										children: entry.expiresAtMs === void 0 ? t("ledgerExpiryUnknown") : expired ? t("ledgerExpired") : t("ledgerExpiresAt", { date: formatDate(entry.expiresAtMs) })
									})
								]
							}, entry.id);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qdp-ledgerFoot",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "qdp-panelMeta",
							children: t("ledgerExpiringHeading")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "qdp-ledgerFootValue",
							children: String(expiringSoonTotal)
						})]
					})
				]
			});
		}
		/**
		* 「模型」面板:可见性开关与每个模型的上下文容量合并到同一行(原先一个只有
		* 一个复选框的「上下文」tab + 一个纯开关列表),刷新模型按钮挪进本栏头部
		* (原先孤悬在账号行上)。max-window 偏好置于列表上方。
		*/
		function ModelsPane({ models, disabledModels = [], catalog, t, busy, onSetModelContextWindow, onSetModelsEnabled, onRefreshModels }) {
			const MODEL_TIER = [
				"auto",
				"ultimate",
				"performance",
				"cmodel",
				"efficient",
				"lite"
			];
			const tierOf = (id) => {
				const index = MODEL_TIER.indexOf(id);
				return index === -1 ? MODEL_TIER.length : index;
			};
			const capabilityOf = (model) => model.defaultContextWindow ?? model.contextWindow ?? 0;
			const list = [...models ?? []].sort((a, b) => {
				const byTier = tierOf(a.id) - tierOf(b.id);
				if (byTier !== 0) return byTier;
				const byCapability = capabilityOf(b) - capabilityOf(a);
				return byCapability !== 0 ? byCapability : a.id.localeCompare(b.id);
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "qdp-list",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qdp-modelHead",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8
							},
							children: [catalog === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-modelMeta",
								children: catalog.source === "live" && catalog.fetchedAt !== void 0 ? t("catalogLive", { time: formatTime(catalog.fetchedAt) }) : catalog.source === "saved" && catalog.fetchedAt !== void 0 ? t("catalogSaved", { time: formatTime(catalog.fetchedAt) }) : t("catalogFallback")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qdp-btn",
								disabled: busy,
								onClick: onRefreshModels,
								children: busy ? t("refreshingModels") : t("refreshModels")
							})]
						})]
					}),
					catalog?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-error",
						children: t("catalogError", { message: catalog.error })
					}),
					list.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-body",
						children: t("modelsNoModels")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qdp-modelColumns",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("modelNameColumn") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("contextHeading") })]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "qdp-modelList",
						children: list.map((model) => {
							const isModelEnabled = !disabledModels.includes(model.id);
							const capacity = model.contextWindow;
							const declared = [...new Set(model.supportedContextWindows ?? (capacity !== void 0 ? [capacity] : []))].sort((a, b) => a - b);
							const stops = [0, ...declared];
							const effective = capacity ?? model.defaultContextWindow;
							const nearest = effective === void 0 || effective <= 0 ? 0 : declared.indexOf(effective) !== -1 ? declared.indexOf(effective) : declared.reduce((best, choice, index) => Math.abs(choice - effective) < Math.abs(declared[best] - effective) ? index : best, 0);
							const currentIndex = effective === void 0 || effective <= 0 ? 0 : nearest + 1;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qdp-modelRow",
								style: { opacity: isModelEnabled ? 1 : .65 },
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "qdp-modelEnable",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: isModelEnabled,
										disabled: busy,
										onChange: (event) => {
											onSetModelsEnabled([model.id], event.currentTarget.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "qdp-modelCopy",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "qdp-modelName",
											children: model.name
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "qdp-modelMeta",
											children: model.id
										})]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "qdp-contextPicker",
									children: declared.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "qdp-windowSlider",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "qdp-windowTrack",
											"aria-hidden": "true",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "qdp-windowFill",
													style: { width: `${String(currentIndex / (stops.length - 1) * 100)}%` }
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "qdp-windowKnob",
													style: { left: `${String(currentIndex / (stops.length - 1) * 100)}%` }
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "qdp-windowInput",
													type: "range",
													min: 0,
													max: stops.length - 1,
													step: 1,
													value: currentIndex,
													disabled: busy,
													"aria-label": `${model.name} ${t("contextHeading")}`,
													"aria-valuetext": currentIndex === 0 ? t("contextHeading") : formatTokens(stops[currentIndex] ?? 0),
													onChange: (event) => {
														const index = Number(event.currentTarget.value);
														const choice = stops[index];
														if (index > 0 && choice !== void 0) onSetModelContextWindow(model.id, choice);
													}
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "qdp-windowTicks",
											"aria-hidden": "true",
											children: (() => {
												const labelled = declared.length <= 3 ? new Set(declared.map((_, index) => index + 1)) : /* @__PURE__ */ new Set([
													1,
													1 + Math.floor((declared.length - 1) / 2),
													stops.length - 1
												]);
												return stops.map((choice, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "qdp-windowTick",
													style: { left: `${String(index / (stops.length - 1) * 100)}%` },
													children: index === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "qdp-windowTickMark" }) : labelled.has(index) ? formatTokens(choice) : null
												}, index));
											})()
										})]
									}) : capacity !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qdp-modelMeta",
										children: formatTokens(capacity)
									}) : null
								})]
							}, model.id);
						})
					})] })
				]
			});
		}
		/**
		* The unified card body: usage first, controls folded.
		*
		* Layout, top to bottom (the workbuddy ordering — one level of variant tabs,
		* then that variant's whole surface vertically):
		*
		* 1. account row: status dot, PAT summary, refresh / replace / clear
		* 2. credit panel: per-package bars AND the cycle summary in one block
		* 3. model area: the max-window preference above the visibility list
		* 4. check-in log (collapsed — it grows unbounded)
		* 5. quota sidebar settings (collapsed — rarely touched, and they gated the
		*    account content when they sat on top)
		*/
		function QoderPluginCard(props) {
			const { t, scope, signedIn, variant, unified, view } = props;
			if (t === void 0) throw new Error("Qoder plugin card requires its translation function");
			const isUnified = unified === true;
			const liveSignIn = (0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSignInState);
			/**
			* The automatic check-in toggles, read from the same settings face the
			* settings rows write. The scheduler arms a timer for EVERY variant (so a
			* toggle flipped on later still fires), so `nextRunAt` alone cannot tell
			* 「已安排」 from 「功能没开」 — this flag is what the card gates the
			* 「下次自动领取」 line on.
			*
			* getSnapshot MUST return the same reference between renders unless the
			* store changed: returning `scope.getSnapshot().value` (a fresh object each
			* call) re-renders forever and trips React's maximum-update-depth guard —
			* the exact hazard `stableProject` documents in QuotaSettingsCard. The
			* projection here is a STRING, so identity is stable by construction.
			*/
			const settingsSubscribe = (0, react.useCallback)((onStoreChange) => {
				return scope?.subscribe(onStoreChange) ?? (() => {});
			}, [scope]);
			const autoCheckInKey = (0, react.useSyncExternalStore)(settingsSubscribe, () => {
				const value = scope?.getSnapshot().value;
				return `${value?.autoCheckInCN === true ? "1" : "0"}${value?.autoCheckInGlobal === true ? "1" : "0"}`;
			});
			const autoCheckInCN = autoCheckInKey.startsWith("1");
			const autoCheckInGlobal = autoCheckInKey.endsWith("1");
			const [activeVariantId, setActiveVariantId] = (0, react.useState)("qoder");
			const currentVariant = isUnified ? activeVariantId === "qoder" ? QODER_CN_CARD : QODER_GLOBAL_CARD : variant ?? QODER_CN_CARD;
			const [status, setStatus] = (0, react.useState)();
			const [signedInState, setSignedInState] = (0, react.useState)();
			const [readFailure, setReadFailure] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const [patDraft, setPatDraft] = (0, react.useState)("");
			const [replacing, setReplacing] = (0, react.useState)(false);
			const [patBusy, setPatBusy] = (0, react.useState)(false);
			const [patError, setPatError] = (0, react.useState)();
			const [patNotice, setPatNotice] = (0, react.useState)();
			const patInput = (0, react.useRef)(null);
			const [checkingIn, setCheckingIn] = (0, react.useState)(false);
			const [clearingLogs, setClearingLogs] = (0, react.useState)(false);
			const [checkInNotice, setCheckInNotice] = (0, react.useState)();
			/** 「清除 PAT」的内联确认：点一次进入确认，再点一次才真正清除。 */
			const [confirmingClear, setConfirmingClear] = (0, react.useState)(false);
			/** 底部双栏 tab:「用量与签到」(默认) / 「模型」。 */
			const [pane, setPane] = (0, react.useState)("usage");
			/**
			* 每个 variant 的启用勾选(workbuddy 的 tab-switch)。这是客户端意图层:
			* 关掉的 variant 不再轮询/显示其内容;模型通道的开关仍由 disabledModels
			* 决定,这里不写宿主配置。
			*/
			const [variantEnabled, setVariantEnabled] = (0, react.useState)({
				cn: true,
				global: true
			});
			const cnEnabled = variantEnabled.cn;
			const globalEnabled = variantEnabled.global;
			/**
			* 大标题的展开态(workbuddy 的 .dsm-plugin-card-header)。默认展开:这是
			* 设置页的卡片,收起只是让用户把注意力让给别的插件。列表视图(摘要)不
			* 参与,所以初值直接给 true。
			*/
			const [headerOpen, setHeaderOpen] = (0, react.useState)(true);
			const mounted = (0, react.useRef)(true);
			const readSeq = (0, react.useRef)(0);
			const manualControllers = (0, react.useRef)(/* @__PURE__ */ new Set());
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
					for (const controller of manualControllers.current) controller.abort();
					manualControllers.current.clear();
				};
			}, []);
			const trackController = (0, react.useCallback)(() => {
				const controller = new AbortController();
				manualControllers.current.add(controller);
				return controller;
			}, []);
			const authKey = status === void 0 || status.status === "error" ? void 0 : status.authKey;
			const refresh = (0, react.useCallback)(async (signal) => {
				const seq = ++readSeq.current;
				const current = () => mounted.current && signal?.aborted !== true && seq === readSeq.current;
				try {
					const response = await fetch(currentVariant.statusPath, {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					if (!isQoderWebStatus(value)) throw new Error(t("statusResponseInvalid"));
					if (!current()) return false;
					setStatus(value);
					if (value.status === "signed-in") {
						setSignedInState(true);
						noteQuotaStatus(currentVariant.id, value);
					} else if (value.status === "signed-out") {
						setSignedInState(false);
						noteQuotaStatus(currentVariant.id, value);
					}
					setReadFailure(void 0);
					return true;
				} catch (error) {
					const message = error instanceof Error ? error.message : t("requestFailed");
					if (current()) {
						setReadFailure(message);
						setStatus((previous) => previous === void 0 ? {
							status: "error",
							message
						} : previous);
					}
					return false;
				}
			}, [currentVariant.statusPath, t]);
			(0, react.useEffect)(() => {
				setStatus(void 0);
				setSignedInState(void 0);
				setReadFailure(void 0);
				setPatDraft("");
				setReplacing(false);
				setPatError(void 0);
				setPatNotice(void 0);
				const controller = new AbortController();
				refresh(controller.signal);
				return () => {
					controller.abort();
				};
			}, [currentVariant.statusPath, refresh]);
			(0, react.useEffect)(() => {
				if (signedInState === false) return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refresh(controller.signal);
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [refresh, signedInState]);
			const manualRefresh = async () => {
				setBusy(true);
				const controller = trackController();
				try {
					await refresh(controller.signal);
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			};
			/**
			* Ask the host to re-read the credential and re-fetch this variant's catalog.
			*
			* Shares the probe route's key and guards: it is a write that spends an
			* upstream request, so it does not belong on the read-only status GET. A
			* failure is surfaced through the refreshed document's `catalog.error` rather
			* than thrown away, so the reason survives the round trip.
			*/
			const refreshModels = (0, react.useCallback)(async () => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setBusy(true);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "refresh" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
					manualControllers.current.delete(controller);
					return;
				} finally {
					if (mounted.current) setBusy(false);
				}
				try {
					await refresh(controller.signal);
				} finally {
					manualControllers.current.delete(controller);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			const manualCheckIn = (0, react.useCallback)(async () => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setCheckingIn(true);
				setCheckInNotice(void 0);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "checkin" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const result = await response.json();
					if (result.state === "claimed") setCheckInNotice(t("autoCheckInStatusClaimed", { amount: result.amount ?? 100 }));
					else if (result.state === "already-claimed") setCheckInNotice(t("autoCheckInStatusAlready"));
					else if (result.state === "no-campaign") setCheckInNotice(t("autoCheckInStatusNoCampaign"));
					else if (result.reason) setCheckInNotice(t("autoCheckInStatusError", { message: result.reason }));
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setCheckInNotice(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setCheckingIn(false);
				}
				try {
					await refresh(controller.signal);
				} finally {
					manualControllers.current.delete(controller);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			(0, react.useCallback)(async () => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setClearingLogs(true);
				setCheckInNotice(void 0);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "clear-checkin-logs" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setCheckInNotice(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setClearingLogs(false);
				}
				try {
					await refresh(controller.signal);
				} finally {
					manualControllers.current.delete(controller);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			/**
			* Run one probe-route control action and refresh the card's state afterwards.
			*
			* The key travels in a header, not the body: it authorizes the write, and
			* the host never accepts a prompt, a sentinel, or a model outside its own
			* catalog from here.
			*/
			const control = (0, react.useCallback)(async (action) => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setBusy(true);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify(action)
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) {
						const message = typeof value === "object" && value !== null && "error" in value ? String(value["error"]) : `HTTP ${response.status}`;
						throw new Error(message);
					}
					if ((action.action === "set-maximum-context-window" || action.action === "set-models-enabled") && (typeof value !== "object" || value === null || value["state"] !== "updated")) {
						const reason = typeof value === "object" && value !== null && "reason" in value ? String(value["reason"]) : t("requestFailed");
						throw new Error(reason);
					}
					await refresh(controller.signal);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			/**
			* Validate and store the pasted PAT (or overwrite the stored one).
			*
			* The PAT route answers both outcomes as 200 with `ok` carrying the verdict —
			* a refused token is an answer, not a transport failure — so the card checks
			* `ok` and translates the stable `qoder_invalid_pat` / `qoder_missing_pat`
			* codes into the re-generate prompt. The route is variant-fixed: the token
			* this card saves can only ever be validated and stored for this product.
			*/
			const savePat = (0, react.useCallback)(async () => {
				const key = authKey;
				const pat = patDraft.trim();
				if (key === void 0 || pat === "" || patBusy) return;
				setPatBusy(true);
				setPatError(void 0);
				setPatNotice(void 0);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.authPath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Auth-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({
							action: "save-pat",
							pat
						})
					});
					const value = await response.json().catch(() => void 0);
					const record = typeof value === "object" && value !== null ? value : {};
					const detail = typeof record["error"] === "string" ? record["error"] : `HTTP ${response.status}`;
					if (!response.ok) {
						setPatError(t("patSaveFailed", { message: detail }));
						return;
					}
					if (record["ok"] !== true) {
						setPatError(detail === "qoder_invalid_pat" || detail === "qoder_missing_pat" ? t("patInvalid") : t("patSaveFailed", { message: detail }));
						return;
					}
					setPatDraft("");
					setReplacing(false);
					setPatNotice(t("patSaved"));
					noteQuotaSignIn(currentVariant.id, true);
					await refresh(controller.signal);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setPatError(t("patSaveFailed", { message: error instanceof Error ? error.message : t("requestFailed") }));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setPatBusy(false);
				}
			}, [
				authKey,
				currentVariant.authPath,
				patBusy,
				patDraft,
				refresh,
				t,
				trackController
			]);
			/** Remove the stored PAT; the host answer is `{ ok: true }`, then the card re-reads. */
			const clearPat = (0, react.useCallback)(async () => {
				const key = authKey;
				if (key === void 0 || patBusy) return;
				setPatBusy(true);
				setPatError(void 0);
				setPatNotice(void 0);
				setReplacing(false);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.authPath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Auth-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "clear" })
					});
					setConfirmingClear(false);
					const value = await response.json().catch(() => void 0);
					const record = typeof value === "object" && value !== null ? value : {};
					if (!response.ok || record["ok"] !== true) {
						const detail = typeof record["error"] === "string" ? record["error"] : `HTTP ${response.status}`;
						setPatError(t("patSaveFailed", { message: detail }));
						return;
					}
					setPatDraft("");
					const signedOutDoc = {
						status: "signed-out",
						authKey: key
					};
					setStatus(signedOutDoc);
					setSignedInState(false);
					noteQuotaStatus(currentVariant.id, signedOutDoc);
					noteQuotaSignIn(currentVariant.id, false);
					await refresh(controller.signal);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setPatError(t("patSaveFailed", { message: error instanceof Error ? error.message : t("requestFailed") }));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setPatBusy(false);
				}
			}, [
				authKey,
				currentVariant.authPath,
				patBusy,
				refresh,
				t,
				trackController
			]);
			(0, react.useCallback)(() => {
				setPatDraft("");
				setPatError(void 0);
				setPatNotice(void 0);
				setReplacing(true);
				requestAnimationFrame(() => {
					patInput.current?.focus();
				});
			}, []);
			const patEntry = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 8
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-body",
						children: t(currentVariant.patGuideKey)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "qdp-patRow",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: patInput,
								type: "password",
								value: patDraft,
								placeholder: t(currentVariant.patPlaceholderKey),
								"aria-label": t("patHeading"),
								disabled: patBusy,
								onChange: (event) => {
									setPatDraft(event.target.value);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										savePat();
									}
								},
								className: "qdp-patInput"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qdp-btn qdp-btnPrimary",
								disabled: patBusy || busy || patDraft.trim() === "",
								onClick: () => {
									savePat();
								},
								children: patBusy ? t("patSaving") : t("patSave")
							}),
							replacing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qdp-btn",
								disabled: patBusy,
								onClick: () => {
									setReplacing(false);
									setPatDraft("");
									setPatError(void 0);
								},
								children: t("cancel")
							}) : null
						]
					}),
					patError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-error",
						children: patError
					}),
					patNotice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "qdp-body",
						children: patNotice
					})
				]
			});
			const cardIntro = isUnified ? t("unifiedIntro") : t(currentVariant.introKey);
			const cardTitle = isUnified ? t("unifiedTitle") : t(currentVariant.titleKey);
			const label = status === void 0 ? t("loading") : status.status === "signed-in" ? t("signedIn") : status.status === "error" ? t("requestFailed") : t("signedOut");
			const signedInLabel = status?.status === "signed-in" && status.pat?.accountName !== void 0 ? t("accountSignedInAs", { name: status.pat.accountName }) : label;
			const reported = signedIn?.();
			const cnSignedIn = reported !== void 0 ? reported.cn : liveSignIn.cn;
			const globalSignedIn = reported !== void 0 ? reported.global : liveSignIn.global;
			const cnDotStatus = isUnified && activeVariantId === "qoder" ? status === void 0 ? "loading" : status.status : cnSignedIn ? "signed-in" : "signed-out";
			const globalDotStatus = isUnified && activeVariantId === "qoder-global" ? status === void 0 ? "loading" : status.status : globalSignedIn ? "signed-in" : "signed-out";
			if (view === "summary") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: cardIntro });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: headerOpen ? "qdp-card qdp-cardOpen" : "qdp-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "qdp-cardHeader",
					"aria-expanded": headerOpen,
					"aria-label": `${headerOpen ? t("cardCollapse") : t("cardExpand")}: ${cardTitle}`,
					onClick: () => {
						setHeaderOpen((open) => !open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: "qdp-cardIcon",
							src: QODER_PLUGIN_ICON,
							alt: "",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "qdp-cardHead",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-cardTitle",
								children: cardTitle
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-cardDescription",
								children: cardIntro
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: headerOpen ? "qdp-cardChevron qdp-cardChevronOpen" : "qdp-cardChevron",
							"aria-hidden": "true"
						})
					]
				}), headerOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qdp-cardBody",
					children: [
						isUnified ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qdp-seg",
							role: "tablist",
							"aria-label": "Qoder Version Selection",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "qdp-segCell",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeVariantId === "qoder",
									className: cnEnabled && activeVariantId === "qoder" ? "qdp-segItem qdp-segItemActive" : "qdp-segItem",
									onClick: () => setActiveVariantId("qoder"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: dotStyle(cnDotStatus),
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("variantTabCN") })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "qdp-segSwitch",
									title: t("variantEnable"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: cnEnabled,
										onChange: (event) => {
											setVariantEnabled((prev) => ({
												...prev,
												cn: event.currentTarget.checked
											}));
										}
									})
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "qdp-segCell",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeVariantId === "qoder-global",
									className: globalEnabled && activeVariantId === "qoder-global" ? "qdp-segItem qdp-segItemActive" : "qdp-segItem",
									onClick: () => setActiveVariantId("qoder-global"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: dotStyle(globalDotStatus),
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("variantTabGlobal") })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "qdp-segSwitch",
									title: t("variantEnable"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: globalEnabled,
										onChange: (event) => {
											setVariantEnabled((prev) => ({
												...prev,
												global: event.currentTarget.checked
											}));
										}
									})
								})]
							})]
						}) }) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qdp-accountBox",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 3,
									minWidth: 0
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "qdp-accountState",
									role: "status",
									"aria-busy": status === void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										style: dotStyle(status === void 0 ? "loading" : status.status)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: signedInLabel })]
								}), status?.status !== "signed-in" || status.pat === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "qdp-accountExpiry",
									children: [
										patSourceText(status.pat.source, t),
										status.pat.savedAtMs === void 0 ? null : t("patSavedAt", { time: formatTime(status.pat.savedAtMs) }),
										status.pat.patTail === void 0 ? null : t("patTail", { tail: `****${status.pat.patTail}` })
									].filter(Boolean).join(" · ")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qdp-btn",
								disabled: busy,
								onClick: () => {
									manualRefresh();
								},
								children: busy ? t("refreshing") : t("refresh")
							})]
						}),
						status?.status !== "signed-in" || status.pat === void 0 ? null : confirmingClear ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qdp-patBox",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-rate",
								children: t("patClearConfirm")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 6
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "qdp-btn qdp-btnDanger",
									disabled: busy || patBusy,
									onClick: () => {
										clearPat();
									},
									children: patBusy ? t("patClearing") : t("patClearConfirmYes")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "qdp-btn",
									disabled: patBusy,
									onClick: () => {
										setConfirmingClear(false);
									},
									children: t("cancel")
								})]
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qdp-patBox",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qdp-patBoxCopy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "qdp-accountState",
									children: t("patBoxLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "qdp-patBoxMeta",
									children: [status.pat.accountName, status.pat.patTail === void 0 ? null : t("patTail", { tail: `****${status.pat.patTail}` })].filter(Boolean).join(" · ")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qdp-btn qdp-btnDangerQuiet",
								disabled: busy || patBusy,
								onClick: () => {
									setConfirmingClear(true);
								},
								children: t("patRemove")
							})]
						}),
						readFailure === void 0 || signedInState === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "qdp-error",
							children: t("statusRefreshFailed", { message: readFailure })
						}),
						status?.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							replacing ? patEntry() : null,
							status.jobTokenRefreshedAt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "qdp-body",
								children: t("jobTokenRefreshed", { time: formatTime(status.jobTokenRefreshedAt) })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageCheckInPanel, {
								credits: status.credits,
								creditsError: status.creditsError,
								checkIn: status.checkIn,
								autoCheckIn: isUnified ? activeVariantId === "qoder" ? autoCheckInCN : autoCheckInGlobal : currentVariant.id === "qoder" ? autoCheckInCN : autoCheckInGlobal,
								t,
								busy,
								checkingIn,
								checkInNotice,
								onCheckIn: () => {
									manualCheckIn();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qdp-paneTabs",
								role: "tablist",
								"aria-label": t("paneUsage"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": pane === "usage",
									className: pane === "usage" ? "qdp-paneTab qdp-paneTabActive" : "qdp-paneTab",
									onClick: () => {
										setPane("usage");
									},
									children: t("paneUsage")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": pane === "models",
									className: pane === "models" ? "qdp-paneTab qdp-paneTabActive" : "qdp-paneTab",
									onClick: () => {
										setPane("models");
									},
									children: t("paneModels")
								})]
							}),
							pane === "models" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelsPane, {
								models: status.models,
								disabledModels: status.disabledModels,
								catalog: status.catalog,
								t,
								busy,
								onSetModelContextWindow: (model, window) => {
									control({
										action: "set-model-context-window",
										model,
										window
									});
								},
								onSetModelsEnabled: (models, enabled) => {
									control({
										action: "set-models-enabled",
										models,
										enabled
									});
								},
								onRefreshModels: () => {
									refreshModels();
								}
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaSettingsContent, {
								t,
								scope,
								signedIn,
								variant: isUnified ? activeVariantId === "qoder" ? "cn" : "global" : currentVariant.id === "qoder" ? "cn" : "global"
							})
						] }) : null,
						status?.status === "signed-out" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: status.reason === void 0 ? "qdp-body" : "qdp-error",
								children: status.reason ?? t(currentVariant.signedOutKey)
							}),
							authKey === void 0 ? null : patEntry(),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "qdp-settingsFlat",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaSettingsContent, {
									t,
									scope,
									signedIn,
									variant: isUnified ? activeVariantId === "qoder" ? "cn" : "global" : currentVariant.id === "qoder" ? "cn" : "global"
								})
							})
						] }) : null,
						status?.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "qdp-error",
							children: status.message
						}) : null
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/QoderProbeControl.tsx
		/**
		* Per-model reasoning-effort entry beside the Composer's model selector.
		*
		* Interaction follows the Fast Mode control `dsh-codex-connect` ships in this
		* same seat, which is the established shape for composer chrome here:
		*
		* - a **static inline label** next to the icon names the feature ("Reasoning
		*   levels"), set smaller and dimmer than the surrounding chrome so it reads as
		*   an annotation on the icon. It never carries state: the verified levels
		*   already appear in the model dropdown (the adapter exposes them as
		*   selectable efforts), so repeating them here would duplicate the real answer
		*   and make the label's width jump as results change.
		* - a **hover/focus tooltip** carries the state and the click's purpose, the way
		*   Fast Mode's tooltip explains its current speed.
		* - the **confirmation** is a small bubble anchored to the control, not a
		*   `window.confirm`. Probing spends real credit, so a confirmation stays — but
		*   it belongs next to the thing it acts on, sized to one line plus two small
		*   buttons.
		*
		* @module dsh-connect-qoder-x/client/probe-control
		*/
		/**
		* The card (and therefore the routes) a selected provider belongs to.
		*
		* The control serves both Qoder providers from one seat, so the provider id
		* is what selects the status and probe endpoints. Returning `undefined` for any
		* other provider is what keeps the icon off every non-Qoder model.
		*/
		function cardVariantFor(provider) {
			return QODER_CARD_VARIANTS.find((card) => card.id === provider);
		}
		/** How often the control re-checks state when the window regains focus. */
		const RECONCILE_MS = 6e4;
		const wrapperStyle = {
			display: "inline-flex",
			position: "relative",
			alignItems: "center",
			transform: "translateY(2px)",
			marginRight: -8
		};
		const buttonStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: 2,
			height: 30,
			padding: "0 6px",
			border: 0,
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			whiteSpace: "nowrap",
			cursor: "pointer"
		};
		/**
		* The inline label. Smaller and dimmer than the surrounding chrome on purpose:
		* it names the feature, so it should read as an annotation attached to the icon
		* rather than compete with the adjacent model selector.
		*/
		const labelStyle = {
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** Tooltip bubble: the Fast Mode shape (nowrap, one line, above the control). */
		const tooltipStyle = {
			position: "absolute",
			left: "50%",
			bottom: "calc(100% + 8px)",
			zIndex: 1e3,
			transform: "translateX(-50%)",
			padding: "4px 8px",
			borderRadius: 6,
			background: "var(--dsw-specific-tip, #1f2329)",
			boxShadow: "var(--dsw-shadow-lv2)",
			color: "var(--dsw-alias-label-primary, #fff)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "nowrap",
			pointerEvents: "none"
		};
		/** Confirmation bubble: same anchor, but interactive and allowed to wrap. */
		const confirmStyle = {
			position: "absolute",
			right: 0,
			bottom: "calc(100% + 8px)",
			zIndex: 1001,
			display: "flex",
			flexDirection: "column",
			gap: 8,
			width: 260,
			padding: "10px 12px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1, #fff)",
			boxShadow: "var(--dsw-shadow-lv2)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const confirmRowStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8
		};
		const confirmButtonStyle = {
			padding: "3px 10px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			background: "transparent",
			color: "inherit",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		/**
		* Primary action inside the confirmation bubble.
		*
		* The fill and its text colour must come as a pair: `brand-primary` resolves to
		* a light accent in this theme, so hardcoding `color: #fff` on top of it renders
		* white-on-white. `button-primary-fill` + `label-primary-foreground` is the
		* theme's own pair for exactly this, and is what `dsh-codex-connect` uses for
		* the same job.
		*/
		const primaryButtonStyle = {
			...confirmButtonStyle,
			border: "1px solid var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		/**
		* Result note: a single line + a dismiss button, anchored to the control's
		* right side. Smaller than the confirmation bubble because it carries an
		* *outcome*, not a *decision* — the work is done, the user only has to read
		* and dismiss.
		*/
		const noteStyle = {
			position: "absolute",
			right: 0,
			bottom: "calc(100% + 8px)",
			zIndex: 1001,
			display: "flex",
			alignItems: "center",
			gap: 12,
			padding: "6px 10px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "var(--dsw-shadow-lv2)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "nowrap"
		};
		/**
		* The note's dismiss action. Outlined rather than bare text: inside an already
		* bordered bubble, an unbordered word does not read as something you can click.
		* Matches the outlined pill convention the plugin's other secondary actions use.
		*/
		const noteDismissStyle = {
			padding: "2px 8px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			cursor: "pointer"
		};
		/**
		* The feature's static inline label. Deliberately not a state readout — see the
		* module comment.
		*/
		function useLabel(t) {
			return t("probeLabel");
		}
		/** Pick the model's recorded observation out of the probe section. */
		function resultFor(status, model) {
			if (status.status !== "signed-in") return void 0;
			return status.probe?.results.find((result) => result.id === model);
		}
		/**
		* The one-line tooltip: current state first, then what a click does — the same
		* two-part shape Fast Mode uses.
		*
		* A recorded result outranks a remembered failure. `failed` only means "the last
		* run from this control did not complete"; the host can record a result for the
		* same model at any time (a detection started from the settings card, another
		* conversation, or a finished sweep), and the levels the user paid for are the
		* more useful answer than the stale failure. Failure copy is what remains when
		* there is no result to report.
		*/
		function tooltipText(t, model, state) {
			if (state.busy) return t("probeRunning", { model });
			const result = state.result;
			if (result !== void 0) {
				if (result.validation === "validating" && result.efforts.length > 0) return t("probeTooltipVerified", { levels: result.efforts.join(" / ") });
				if (result.validation === "non-validating") return t("probeTooltipNotValidating");
				return t("probeTooltipRetry");
			}
			if (state.failed) return t("probeTooltipRetry");
			return t("probeTooltipIdle", { model });
		}
		/** Model-independent shell: resolves the selection, then delegates per model. */
		function QoderProbeControl({ directory, t }) {
			const subscribe = (0, react.useCallback)((listener) => directory.subscribe(listener), [directory]);
			const snapshot = (0, react.useCallback)(() => directory.getSnapshot(), [directory]);
			const selection = (0, react.useSyncExternalStore)(subscribe, snapshot, snapshot).current;
			const card = selection == null ? void 0 : cardVariantFor(selection.provider);
			const key = card === void 0 || selection == null ? void 0 : `${card.id}:${selection.model}`;
			return card === void 0 || selection == null || key === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelProbe, {
				model: selection.model,
				card,
				label: useLabel(t),
				t
			}, key);
		}
		function ModelProbe({ model, card, label, t }) {
			const [status, setStatus] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [tooltipVisible, setTooltipVisible] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const [note, setNote] = (0, react.useState)();
			const inFlight = (0, react.useRef)(false);
			const mounted = (0, react.useRef)(false);
			const readSeq = (0, react.useRef)(0);
			const tooltipId = (0, react.useId)();
			const refresh = (0, react.useCallback)(async (signal) => {
				const seq = ++readSeq.current;
				const response = await fetch(card.statusPath, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
					...signal === void 0 ? {} : { signal }
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const value = await response.json().catch(() => void 0);
				if (!isQoderWebStatus(value)) throw new Error(t("statusResponseInvalid"));
				if (mounted.current && !signal?.aborted && seq === readSeq.current) setStatus(value);
			}, [card.statusPath, t]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				const controller = new AbortController();
				const load = () => {
					refresh(controller.signal).catch(() => {});
				};
				load();
				const timer = window.setInterval(load, RECONCILE_MS);
				window.addEventListener("focus", load);
				return () => {
					mounted.current = false;
					controller.abort();
					window.clearInterval(timer);
					window.removeEventListener("focus", load);
				};
			}, [refresh]);
			const probe = status?.status === "signed-in" ? status.probe : void 0;
			const key = status?.status === "signed-in" ? status.probeKey : void 0;
			const result = status === void 0 ? void 0 : resultFor(status, model);
			const visible = probe?.candidates.includes(model) === true || result !== void 0;
			(0, react.useEffect)(() => {
				if (result !== void 0) setFailed(false);
			}, [result]);
			(0, react.useEffect)(() => {
				setConfirming(false);
				setNote(void 0);
			}, [model]);
			const detect = async () => {
				if (key === void 0 || inFlight.current || probe?.running === true) return;
				inFlight.current = true;
				setNote(void 0);
				setConfirming(false);
				setBusy(true);
				setFailed(false);
				try {
					const response = await fetch(card.probePath, {
						method: "POST",
						credentials: "same-origin",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Probe-Key": key
						},
						body: JSON.stringify({
							action: "probe",
							model
						})
					});
					const body = await response.json();
					if (!response.ok || body.state !== "ok" || body.validation !== "validating" && body.validation !== "non-validating" || !Array.isArray(body.efforts) || !body.efforts.every((effort) => typeof effort === "string")) throw new Error("probe failed");
					if (mounted.current) {
						const completed = {
							id: model,
							name: model,
							validation: body.validation,
							efforts: body.efforts,
							probedAt: Date.now()
						};
						setNote(completed);
					}
					refresh().catch(() => {});
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					inFlight.current = false;
					if (mounted.current) setBusy(false);
				}
			};
			if (!visible) return null;
			const text = tooltipText(t, model, {
				busy,
				result,
				failed
			});
			const disabled = busy || probe?.running === true || key === void 0;
			const showTooltip = tooltipVisible && !confirming && note === void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: wrapperStyle,
				onMouseEnter: () => {
					setTooltipVisible(true);
				},
				onMouseLeave: () => {
					setTooltipVisible(false);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-label": text,
						"aria-describedby": showTooltip ? tooltipId : void 0,
						"aria-busy": busy,
						"aria-expanded": confirming,
						disabled,
						onClick: () => {
							setConfirming(true);
						},
						onFocus: () => {
							setTooltipVisible(true);
						},
						onBlur: () => {
							setTooltipVisible(false);
						},
						style: {
							...buttonStyle,
							opacity: disabled && !confirming ? .6 : 1,
							cursor: disabled ? "default" : "pointer"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6",
							"aria-hidden": "true",
							focusable: "false",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "9"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "4"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 12 20 4" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "1"
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: labelStyle,
							children: label
						})]
					}),
					showTooltip && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						id: tooltipId,
						role: "tooltip",
						style: tooltipStyle,
						children: text
					}),
					confirming && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: confirmStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("probeBubbleBody") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: confirmRowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: confirmButtonStyle,
								onClick: () => {
									setConfirming(false);
								},
								children: t("cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primaryButtonStyle,
								onClick: () => {
									detect();
								},
								children: t("probeConfirmAction")
							})]
						})]
					}),
					note === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						role: "status",
						"aria-live": "polite",
						style: noteStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: noteText(t, note) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: noteDismissStyle,
							onClick: () => {
								setNote(void 0);
							},
							children: t("probeNoteDismiss")
						})]
					})
				]
			});
		}
		/** Compose the one-line outcome string the note bubble shows. */
		function noteText(t, result) {
			if (result.validation === "validating" && result.efforts.length > 0) return t("probeNoteVerified", { levels: result.efforts.join(" / ") });
			if (result.validation === "non-validating") return t("probeNoteNotValidating");
			return t("probeNoteUnknown");
		}
		//#endregion
		//#region src/client/http-settings-scope.ts
		/** Base path of the host half's settings face. */
		const ROUTE_BASE = "/plugins/dsh-connect-qoder-x";
		/**
		* Fetch one settings face document.
		* @param init - the request init (method, headers, body).
		* @returns the parsed document.
		* @throws when the transport or the host refuses the request.
		*/
		async function request(init) {
			const response = await fetch(`${ROUTE_BASE}/settings`, {
				credentials: "same-origin",
				...init
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) {
				const error = typeof value === "object" && value !== null && "error" in value ? String(value["error"]) : `HTTP ${response.status}`;
				throw new Error(error);
			}
			if (typeof value !== "object" || value === null || !("value" in value)) throw new Error("qoder: settings face answered an invalid document");
			return value;
		}
		/**
		* The scope the card was written against, backed by this plugin's own file.
		*
		* A write optimistically adopts the value it just sent, then confirms with the
		* host's answer (which re-reads the file it wrote), so the card never renders a
		* value the host does not hold.
		*/
		var OwnQuotaSettingsScope = class {
			document;
			listeners = /* @__PURE__ */ new Set();
			snapshot = {
				status: "loading",
				value: void 0,
				writable: true
			};
			/**
			* Load the current document. Call once before the card binds; repeated calls
			* are harmless and re-read the host.
			* @returns the effective values.
			*/
			async load() {
				try {
					this.document = await request({ headers: { accept: "application/json" } });
				} catch {
					return;
				}
				this.publish();
				return this.document.value;
			}
			/** @returns the stable snapshot the card reads (ready once loaded). */
			getSnapshot() {
				return this.snapshot;
			}
			/** @param listener - invoked after every snapshot change. @returns the disposer. */
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			/**
			* Write one field.
			* @param field - field name inside the settings document.
			* @param value - the JSON-shaped value to store.
			* @returns whether the host accepted the write.
			*/
			async set(field, value) {
				return this.patch({ [field]: value });
			}
			/**
			* Clear one field: the value falls back to the schema default.
			* @param field - field name inside the settings document.
			* @returns whether the host accepted the clear.
			*/
			async unset(field) {
				return this.patch({ [field]: null });
			}
			/** Send one patch and adopt the host's answer. */
			async patch(patch) {
				const key = this.document?.key;
				if (key === void 0) return false;
				try {
					this.document = await request({
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Qoder-Settings-Key": key
						},
						body: JSON.stringify(patch)
					});
					this.publish();
					return true;
				} catch {
					return false;
				}
			}
			/** Rebuild the cached snapshot and notify the subscribers. */
			publish() {
				this.snapshot = {
					status: this.document === void 0 ? "loading" : "ready",
					value: this.document?.value,
					writable: true
				};
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region src/client/quota-merge.ts
		/**
		* Group credit accounts by (packageName, packageEndTime) and sum each group.
		*
		* A missing figure counts as 0 (the user's ruling): a package whose total the
		* upstream did not report contributes nothing to the group's `size` rather
		* than poisoning the bar into "unknown". A group whose summed `size` is still
		* 0 keeps an honest "unknown total" rendering in the card — the merge never
		* invents a denominator. `unlimited` is sticky: one unlimited member makes the
		* whole group unlimited, and its sums are not displayed as a quota.
		*
		* MERGE KEY IS THE NAME ALONE (the user's correction): same-named packages
		* whose expiries differ by seconds (stacked purchase batches) must still be
		* one overview row — keying on the expiry exploded 28 same-named packages
		* back into 28 separate bars the moment the host started reporting real
		* dates. The expiry travels on the group (earliest of the members) for the
		* sort/visibility rules; the itemised per-expiry breakdown lives in the
		* dashboard's table.
		*
		* @param accounts - the status document's per-package credit entries.
		* @returns one group per distinct package NAME, in first-seen order.
		*/
		function mergeCreditAccounts(accounts) {
			const groups = /* @__PURE__ */ new Map();
			for (const account of accounts) {
				const key = account.packageName;
				const existing = groups.get(key);
				if (existing === void 0) {
					groups.set(key, {
						packageName: account.packageName,
						packageEndTime: account.packageEndTime,
						remain: account.remain,
						size: account.size,
						unlimited: account.unlimited === true
					});
					continue;
				}
				existing.remain += account.remain;
				existing.size += account.size;
				existing.unlimited = existing.unlimited || account.unlimited === true;
				if (existing.packageEndTime !== void 0 && account.packageEndTime !== void 0) {
					const a = Date.parse(existing.packageEndTime);
					const b = Date.parse(account.packageEndTime);
					if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) existing.packageEndTime = account.packageEndTime;
				} else existing.packageEndTime = existing.packageEndTime ?? account.packageEndTime;
			}
			return [...groups.values()];
		}
		/** Clamp helper shared by the card's percent math. */
		function clampPercent(remain, size) {
			if (!(size > 0)) return void 0;
			const percent = remain / size * 100;
			if (!Number.isFinite(percent)) return void 0;
			return Math.min(100, Math.max(0, percent));
		}
		/** Parse an upstream expiry string ("YYYY-MM-DD HH:mm:ss") into a timestamp; undefined when unparseable. */
		function parseExpiry(value) {
			if (value === void 0) return void 0;
			const parsed = Date.parse(value);
			return Number.isNaN(parsed) ? void 0 : parsed;
		}
		/** Whether a group is spent (remain 0) and NOT unlimited. */
		function isSpent(group) {
			return !group.unlimited && group.remain <= 0;
		}
		/** Whether a spent group's expiry date has already passed (undated → false: no proof of expiry). */
		function isExpired(group, now) {
			if (!isSpent(group)) return false;
			const expiry = parseExpiry(group.packageEndTime);
			return expiry !== void 0 && expiry < now;
		}
		/**
		* SIDEBAR overview rule (the user's spec, restored after it was wrongly
		* applied to the panel):
		*
		* - A group with credit LEFT (remain > 0, or unlimited) renders.
		* - A SPENT group (remain 0) renders ONLY when EVERY group is spent AND it
		*   is not expired — the account's standing quota whose emptiness is itself
		*   the news. When anything still has credit, spent rows are noise.
		* - An EXPIRED group (spent and its expiry date has passed) renders
		*   NOWHERE, whatever the rest of the account looks like.
		*
		* Applied AFTER the merge so the sums are settled before the test.
		* "Now" is injectable for tests.
		*
		* @param groups - merged groups, in first-seen order.
		* @param now - current timestamp (defaults to Date.now()).
		* @returns the groups to display, in first-seen order.
		*/
		function visibleQuotaGroups(groups, now = Date.now()) {
			const hasCredit = groups.some((group) => group.unlimited || group.remain > 0);
			return groups.filter((group) => {
				if (group.unlimited || group.remain > 0) return true;
				return !hasCredit && !isExpired(group, now);
			});
		}
		/**
		* PANEL detail-table ordering (the user's spec): every row renders — the
		* panel is the itemised ledger — but spent-yet-still-active rows sink to the
		* BOTTOM (lowest priority), and expired rows are dropped entirely. Rows keep
		* their first-seen order within each band.
		*
		* @param rows - per-package rows, unmerged, in first-seen order.
		* @param now - current timestamp (defaults to Date.now()).
		*/
		function sortPackageRows(rows, now = Date.now()) {
			const live = [];
			const spent = [];
			for (const row of rows) {
				const unlimited = row.unlimited === true;
				const expiry = parseExpiry(row.packageEndTime);
				if (!unlimited && row.remain <= 0 && expiry !== void 0 && expiry < now) continue;
				if (unlimited || row.remain > 0) live.push(row);
				else spent.push(row);
			}
			return [...live, ...spent];
		}
		//#endregion
		//#region src/client/SidebarQuotaCard.tsx
		/**
		* The sidebar footer quota card + the center-column dashboard it opens.
		*
		* The structure is a direct port of commandcode's plans & quota panel
		* (src/client/panel-view.tsx + panel.ts), which the user held up as the
		* reference: the card IS the button (the shell supplies no chrome), it renders
		* one block per merged package group — the group's remain/total, its
		* percentage and its bar — carries the last-updated time in the card's top
		* row, and opens a dashboard in the layout's keyed `main` slot on click. In
		* the 56px rail it collapses to a 36px icon button carrying the ring.
		*
		* Data comes from the variant's status route (poll, paused while hidden);
		* strings come from the `panel.qoder-quota` locale namespace; classes come
		* from `./quota-styles.ts` (`qdp-` prefix).
		*/
		/** Fallback translator: renders keys bare rather than throwing unbound. */
		const fallbackT = (key) => key;
		/**
		* Identity line under the dashboard card title: the redacted PAT tail when a
		* token is on file, plain signed-in copy if the summary is missing, and the
		* save-a-PAT hint otherwise. There is no nickname on a PAT document.
		*/
		function ownerText(status, t) {
			if (status === void 0 || status.status !== "signed-in") return t("quotaNotSignedIn");
			const tail = status.pat?.patTail;
			return tail === void 0 ? t("signedIn") : t("patTail", { tail: `****${tail}` });
		}
		/** Project the credit accounts into the card's bar list. */
		function buildBars(accounts) {
			const groups = visibleQuotaGroups(mergeCreditAccounts(accounts));
			const bars = [];
			for (const group of groups) {
				const percent = group.unlimited ? void 0 : clampPercent(group.remain, group.size);
				const detail = group.unlimited ? "∞" : percent === void 0 ? `${group.remain.toLocaleString()} · ?` : `${group.remain.toLocaleString()} / ${group.size.toLocaleString()}`;
				bars.push({
					label: group.packageName,
					detail,
					percent: percent === void 0 ? void 0 : `${Math.round(percent)}%`,
					barPercent: percent === void 0 ? 0 : Math.max(2, percent),
					warn: !group.unlimited && percent !== void 0 && percent < 20,
					packageEndTime: group.packageEndTime
				});
			}
			return bars;
		}
		/**
		* The quota ring — commandcode's glyph ported verbatim (`qdp-` classes): a
		* faint track plus an arc whose sweep is the consumption, drawn from 12
		* o'clock. Circumference 2πr = 45.55 at r = 7.25.
		*/
		function Ring({ percent, warn, size }) {
			const clamped = Math.min(100, Math.max(0, percent));
			const circumference = 45.55;
			const dashoffset = Math.round(circumference * (1 - clamped / 100) * 1e3) / 1e3;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "qdp-glyph",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 20 20",
					width: size,
					height: size,
					focusable: "false",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7.25",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.5",
						opacity: "0.4"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7.25",
						fill: "none",
						stroke: warn ? "var(--dsw-alias-state-error-primary)" : "currentColor",
						strokeWidth: "2.5",
						strokeLinecap: "round",
						strokeDasharray: String(circumference),
						strokeDashoffset: String(dashoffset),
						transform: "rotate(-90 10 10)"
					})]
				})
			});
		}
		/**
		* The dashboard's detail rows: EVERY package as the upstream reported it —
		* no merging, exhausted ones included. The sidebar card shows the merged
		* overview; this panel is the itemised ledger, so collapsing here would
		* destroy the only place a per-package figure is visible.
		*/
		function buildPackageRows(accounts) {
			return sortPackageRows(accounts).map((account) => {
				const percent = account.unlimited === true ? void 0 : clampPercent(account.remain, account.size);
				return {
					name: account.packageName,
					remain: account.remain,
					size: account.size,
					percent,
					warn: account.unlimited !== true && percent !== void 0 && percent < 20,
					packageEndTime: account.packageEndTime
				};
			});
		}
		/** Time-of-day formatter for the updated stamp. */
		function timeText(ms) {
			return new Date(ms).toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		/** One variant's sidebar quota card. */
		function SidebarQuotaCard(props) {
			const { t = fallbackT, statusPath, open } = props;
			const variantId = statusPath !== void 0 ? variantOfStatusPath(statusPath) : "qoder";
			const nameKey = variantId === "qoder-global" ? "quotaCardGlobal" : "quotaCardCN";
			const wide = props.wide !== false;
			const [failed, setFailed] = (0, react.useState)(false);
			(0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSettingsRevision);
			const enabled = variantId === "qoder" ? quotaToggles().cn : quotaToggles().global;
			const status = quotaStatus(variantId);
			const signedIn = status?.status === "signed-in";
			(0, react.useEffect)(() => {
				if (statusPath === void 0 || !enabled) return void 0;
				let disposed = false;
				let timer;
				const controller = new AbortController();
				const refresh = async () => {
					try {
						const response = await fetch(statusPath, {
							signal: controller.signal,
							headers: { accept: "application/json" }
						});
						const body = await response.json();
						if (disposed) return;
						if (!response.ok || !isQoderWebStatus(body)) {
							setFailed(true);
							return;
						}
						setFailed(false);
						noteQuotaStatus(variantId, body);
					} catch {
						if (!disposed) setFailed(true);
					}
				};
				const isHidden = () => typeof document !== "undefined" && document.hidden;
				const loop = () => {
					if (isHidden()) return;
					refresh();
				};
				timer = window.setInterval(loop, Math.max(6e4, quotaPollMs()));
				refresh();
				const onVisible = () => {
					if (!isHidden()) loop();
				};
				if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
				return () => {
					disposed = true;
					controller.abort();
					if (timer !== void 0) window.clearInterval(timer);
					if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
				};
			}, [
				statusPath,
				enabled,
				variantId
			]);
			if (enabled === false) return null;
			const credits = status !== void 0 && "credits" in status ? status.credits : void 0;
			const bars = credits === void 0 ? [] : buildBars(credits.accounts ?? []);
			const lowest = bars.reduce((acc, bar) => {
				if (bar.percent === void 0) return acc;
				const value = Number.parseFloat(bar.percent);
				if (!Number.isFinite(value)) return acc;
				return acc === void 0 ? value : Math.min(acc, value);
			}, void 0);
			const ringPercent = failed || status === void 0 ? 0 : credits?.unlimited === true ? 100 : lowest ?? 0;
			const ringWarn = failed || lowest !== void 0 && lowest < 20;
			const fetchedAt = quotaStatusFetchedAt(variantId);
			const title = [
				t(nameKey),
				...bars.map((bar) => `${bar.label} ${bar.detail}${bar.percent === void 0 ? "" : ` (${bar.percent})`}`),
				fetchedAt !== void 0 ? `${t("quotaUpdated")} ${timeText(fetchedAt)}` : ""
			].filter((part) => part !== "").join(" · ");
			if (!wide) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "qdp-railButton",
				"aria-label": title,
				title,
				disabled: !signedIn,
				onClick: () => {
					if (!signedIn) return;
					open?.();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
					percent: ringPercent,
					warn: ringWarn,
					size: 18
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "qdp-foot",
				"aria-label": title,
				title,
				disabled: !signedIn,
				onClick: () => {
					if (!signedIn) return;
					open?.();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "qdp-footTop",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
							percent: ringPercent,
							warn: ringWarn,
							size: 16
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "qdp-footName",
							children: t(nameKey)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						fetchedAt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "qdp-updated",
							children: [
								t("quotaUpdated"),
								" ",
								timeText(fetchedAt)
							]
						}) : null
					]
				}), failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "qdp-footRow",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "qdp-footLabel",
						children: t("quotaError")
					})
				}) : bars.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "qdp-footRow",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "qdp-footLabel",
						children: status === void 0 ? "…" : !("credits" in status) ? t("quotaNotSignedIn") : status.creditsError ?? t("quotaError")
					})
				}) : bars.map((bar, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "qdp-footRow",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "qdp-footHead",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-footLabel",
								title: bar.packageEndTime !== void 0 ? `${t("quotaExpires")} ${bar.packageEndTime}` : t("quotaNoExpiry"),
								children: bar.label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-footAmount",
								children: bar.detail
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qdp-footPct",
								children: bar.percent ?? ""
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "qdp-footBar",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bar.warn ? "qdp-footFill qdp-footFillWarn" : "qdp-footFill",
							style: { width: `${bar.barPercent}%` }
						})
					})]
				}, `${index}\u0000${bar.label}\u0000${bar.packageEndTime ?? ""}`))]
			});
		}
		/**
		* The center-column dashboard, registered into the layout's keyed `main` slot
		* under the id the footer cards select, so card → panel is one navigation
		* entry. One variant at a time, switched by tabs (commandcode's account-tab
		* pattern): CN and international are separate accounts with separate package
		* lists, so mixing them into one column would misattribute every number.
		*
		* The panel fetches BOTH routes itself on mount and on the shared poll
		* interval — a user opening the panel must never wait for the sidebar cards'
		* next tick, and must never see a stale "sign in" just because no poll had
		* run yet. The tab defaults to the variant whose card was clicked.
		*/
		function QuotaDashboard(props) {
			const { t = fallbackT, statusPaths, refresh, close, useQuotaDashboard, onVariantPicked } = props;
			(0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSettingsRevision);
			const state = useQuotaDashboard((s) => s);
			const followedPath = state.activePath;
			const [userPicked, setUserPicked] = (0, react.useState)(void 0);
			const activePathResolved = userPicked ?? followedPath;
			const activeVariant = variantOfStatusPath(activePathResolved);
			const status = quotaStatus(activeVariant);
			const loading = state.loading;
			const fetchedAt = state.fetchedAt;
			const credits = status !== void 0 && "credits" in status ? status.credits : void 0;
			const rows = credits === void 0 ? [] : buildPackageRows(credits.accounts ?? []);
			const nameKey = activeVariant === "qoder-global" ? "quotaCardGlobal" : "quotaCardCN";
			const signedIn = status?.status === "signed-in";
			const totalRemain = credits === void 0 ? 0 : credits.accounts.reduce((sum, account) => sum + account.remain, 0);
			const totalSize = credits?.totalSize ?? credits?.accounts.reduce((sum, account) => sum + account.size, 0) ?? 0;
			const totalPercent = clampPercent(totalRemain, totalSize);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "qdp-main",
				role: "region",
				"aria-label": t("quotaDashboardTitle"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qdp-mainInner",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "qdp-header",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "qdp-headerText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: "qdp-title",
										children: t("quotaDashboardTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "qdp-subtitle",
										children: t("quotaDashboardSubtitle")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "qdp-spacer" }),
								fetchedAt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "qdp-meta",
									children: [
										t("quotaUpdated"),
										" ",
										timeText(fetchedAt)
									]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "qdp-refresh",
									disabled: loading,
									onClick: () => refresh(),
									children: loading ? t("quotaRefreshing") : t("quotaRefresh")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "qdp-close",
									"aria-label": t("quotaClose"),
									title: t("quotaClose"),
									onClick: () => close(),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: "×"
									})
								})
							]
						}),
						statusPaths.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "qdp-tabs",
							role: "tablist",
							"aria-label": t("quotaDashboardTitle"),
							children: statusPaths.map((path) => {
								const key = variantOfStatusPath(path) === "qoder-global" ? "quotaCardGlobal" : "quotaCardCN";
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": path === activePathResolved,
									className: path === activePathResolved ? "qdp-tab qdp-tabActive" : "qdp-tab",
									onClick: () => {
										setUserPicked(path);
										onVariantPicked(path);
									},
									children: t(key)
								}, path);
							})
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "qdp-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qdp-cardHead",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qdp-avatar",
										children: activeVariant === "qoder-global" ? "GL" : "CN"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "qdp-cardIdentity",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "qdp-cardTitle",
											children: t(nameKey)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "qdp-cardOwner",
											children: ownerText(status, t)
										})]
									}),
									credits?.unlimited === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qdp-badge",
										children: t("quotaUnlimited")
									}) : null
								]
							}), !signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "qdp-notice",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "qdp-noticeTitle",
									children: t("quotaNotSignedIn")
								})
							}) : credits === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "qdp-notice qdp-noticeError",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "qdp-noticeTitle",
									children: t("quotaError")
								})
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "qdp-totalLine",
									children: [
										t("quotaTotalRemain"),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
											className: "qdp-totalValue",
											children: totalRemain.toLocaleString()
										}),
										" / ",
										totalSize > 0 ? totalSize.toLocaleString() : t("quotaUnknownTotal")
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "qdp-totalSub",
									children: t("quotaTotalShare", {
										percent: totalPercent === void 0 ? t("quotaUnknownTotal") : `${totalPercent.toFixed(2)}%`,
										remain: totalRemain.toLocaleString(),
										size: totalSize.toLocaleString()
									})
								}),
								Number.isFinite(credits.total) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "qdp-totalSub",
									children: t("quotaCycleUsed", { percent: String(credits.total) })
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "qdp-bar",
									role: "progressbar",
									"aria-label": t("quotaTotal"),
									...totalPercent === void 0 ? { "aria-valuetext": t("quotaUnknownTotal") } : {
										"aria-valuemin": 0,
										"aria-valuemax": 100,
										"aria-valuenow": Math.round(totalPercent)
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: totalPercent !== void 0 && totalPercent < 20 ? "qdp-barFill qdp-barFillWarn" : "qdp-barFill",
										style: {
											width: totalPercent === void 0 ? "100%" : `${Math.max(2, totalPercent)}%`,
											opacity: totalPercent === void 0 ? .25 : 1
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "qdp-blockTitle",
									children: t("quotaByPackage")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
									className: "qdp-table",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("quotaColPackage") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("quotaColRemain") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("quotaColExpiry") })
									] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
											className: "qdp-num",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "qdp-numText",
												children: [
													row.remain.toLocaleString(),
													" / ",
													row.size.toLocaleString()
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "qdp-miniBar",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: row.warn ? "qdp-footFill qdp-footFillWarn" : "qdp-footFill",
													style: {
														display: "block",
														height: "100%",
														borderRadius: 999,
														width: row.percent === void 0 ? "100%" : `${Math.max(2, row.percent)}%`,
														opacity: row.percent === void 0 ? .25 : 1
													}
												})
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "qdp-expiry",
											title: row.packageEndTime ?? t("quotaNoExpiry"),
											children: row.packageEndTime ?? "—"
										})
									] }, `${index}\u0000${row.name}\u0000${row.packageEndTime ?? ""}`)) })]
								}),
								credits.cycleResetTime !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "qdp-windowReset",
									children: [
										t("quotaExpires"),
										" ",
										credits.cycleResetTime
									]
								}) : null
							] })]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/quota-styles.ts
		/**
		* Stylesheet for the Qoder quota surfaces (the sidebar footer card and the
		* dashboard it opens) — a direct translation of commandcode's panel stylesheet
		* (src/client/panel-styles.ts), which the user held up as the reference look.
		* Classes are `qdp-` prefixed to stay clear of commandcode's `ccp-` set: both
		* plugins inject GLOBAL CSS into the same document, so the prefixes must not
		* collide.
		*
		* Same contract as the original: returned as a string (no DOM side effects at
		* import time), installed once by the client entry keyed by `data-plugin-css`,
		* and removed when the plugin's fiber unwinds. Every colour comes from a
		* harness theme alias with a neutral fallback.
		*/
		/** Stylesheet id (the `data-plugin-css` value that makes injection idempotent). */
		const QUOTA_CSS_ID = "dsh-connect-qoder-x/QuotaPanel.module.css";
		/** Install the stylesheet once; returns its disposer. */
		function injectQuotaCss() {
			if (typeof document === "undefined") return () => {};
			if (document.querySelector(`style[data-plugin-css="dsh-connect-qoder-x/QuotaPanel.module.css"]`) !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-connect-qoder-x";
			tag.dataset.pluginCss = QUOTA_CSS_ID;
			tag.textContent = QUOTA_CSS;
			document.head.appendChild(tag);
			return () => {
				tag.remove();
			};
		}
		/** The quota panel stylesheet. */
		const QUOTA_CSS = `
/* ------------------------------------------------- sidebar footer card */
/* The shell's foot area renders this list ABOVE the Settings seat. The shell
   supplies no chrome: the entry is the button. Deliberately quiet — a surface
   beside Settings should read as part of the column — one hover step and a
   hairline border, exactly like commandcode's card.

   The shell's container is a flex ROW whose occupants each declare a
   full-width line, so as a row it overflows the column. The fix is the same
   load-bearing anchored rule commandcode ships (their issue #48): force the
   sidebar's footer-action container into a column, anchored to "_footArea"
   because "footerActions" is also used by the ask-user-question dialog — an
   unanchored rule would stack THAT dialog's buttons too. Anchoring keeps the
   fix scoped to the sidebar; the descendant combinator survives a wrapper
   appearing between the two. The rule is idempotent when commandcode is also
   installed (same selector, same declaration) and makes this plugin
   self-sufficient when it is not. */
[class*="_footArea"] [class*="_footerActions"]{flex-direction:column}
.qdp-foot{box-sizing:border-box;flex:0 0 auto;width:100%;min-width:0;font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px;flex-direction:column;gap:6px;margin:0 0 4px;padding:8px;display:flex}
.qdp-foot:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.qdp-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-footTop{align-items:center;gap:8px;min-width:0;display:flex}
.qdp-footName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;font-size:13px;font-weight:500;line-height:20px}
.qdp-updated{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
/* One block per merged package group: a head line carrying the group's own
   remain/total, then the FULL-WIDTH bar under it. Stacking the two lets the
   card show the figures — the reason this surface exists — without squeezing
   the bar into what is left beside them. */
.qdp-footRow{flex-direction:column;gap:4px;min-width:0;display:flex}
.qdp-footHead{align-items:baseline;gap:8px;min-width:0;display:flex}
.qdp-footLabel{flex:1;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qdp-footAmount{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
/* The card's markup must stay PHRASING content — it renders inside the shell's
   own button — so these bars are spans, not divs. display:block is
   load-bearing on BOTH: an inline box ignores width and height outright, so
   without it the fill collapses to 0x0 and the bar shows no usage. */
.qdp-footBar{display:block;background:var(--dsw-alias-bg-layer-2);border-radius:999px;height:5px;overflow:hidden}
.qdp-footFill{display:block;background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
.qdp-footFillWarn{background:var(--dsw-alias-state-error-primary)}
.qdp-footPct{flex:none;width:34px;color:var(--dsw-alias-label-secondary);text-align:right;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}

/* The 56px rail: one icon button on the shell's own rail geometry (36px cell),
   so the collapsed column keeps a single glyph like its siblings. */
.qdp-railButton{box-sizing:border-box;width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px;flex:none;justify-content:center;align-items:center;margin:0 0 4px;padding:0;display:inline-flex}
.qdp-railButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qdp-railButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

/* The ring glyph. Sized entirely by its own width/height attribute, so the
   footer row and the rail button can each ask for their own. */
.qdp-glyph{flex:none;justify-content:center;align-items:center;display:inline-flex;color:var(--dsw-alias-brand-primary)}
.qdp-ringWarn{color:var(--dsw-alias-state-error-primary)}

/* Pure-CSS caret for the card's collapsible sections. The host primitives'
   chevron icon names differ per DSH line, so no static import can serve both —
   a border caret in the plugin's own CSS is version-proof (workbuddy's
   approach, restated under this plugin's qdp- prefix). */
.qdp-chevron{flex:none;width:16px;height:16px;position:relative;transition:transform .16s}
.qdp-chevron::before{content:"";display:block;position:absolute;left:4px;top:5px;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.qdp-chevronOpen{transform:rotate(180deg)}

/* ------------------------------------------------------------ dashboard */
/* The center column in the layout frame: fill it, scroll the content column,
   and cap the reading width like the harness's own panels. */
.qdp-main{background:var(--dsw-alias-bg-layer-1);width:100%;height:100%;overflow:auto;display:block}
.qdp-mainInner{max-width:760px;margin:0 auto;padding:24px 20px 40px;flex-direction:column;gap:14px;display:flex;color:var(--dsw-alias-label-primary)}
.qdp-header{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.qdp-headerText{flex-direction:column;gap:2px;display:flex;min-width:0}
.qdp-title{margin:0;font-size:18px;font-weight:600;line-height:1.4}
.qdp-subtitle{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.qdp-spacer{flex:1}
.qdp-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}
/* The dashboard's exit: an icon-sized glyph button. */
.qdp-close{min-width:28px;justify-content:center;padding-left:0;padding-right:0;box-sizing:border-box;align-items:center;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;height:28px;display:inline-flex}
.qdp-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qdp-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-close span{font-size:16px;line-height:1}
.qdp-refresh{box-sizing:border-box;align-items:center;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 12px;display:inline-flex;gap:6px;font-size:12px;line-height:18px}
.qdp-refresh:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.qdp-refresh:disabled{opacity:.5;cursor:default}
.qdp-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

/* Notices: signed-out and error states. */
.qdp-notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:12px 14px;flex-direction:column;gap:4px;display:flex}
.qdp-noticeError{border-color:var(--dsw-alias-state-error-primary)}
.qdp-noticeTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5}
.qdp-noticeHint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}

/* One card per variant. */
.qdp-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:16px 18px;flex-direction:column;gap:16px;display:flex}
.qdp-cardHead{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.qdp-avatar{flex:none;width:28px;height:28px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform);border-radius:50%;justify-content:center;align-items:center;font-size:12px;font-weight:600;line-height:1;display:inline-flex}
.qdp-cardIdentity{flex-direction:column;gap:1px;min-width:0;display:flex}
.qdp-cardTitle{font-size:13px;font-weight:600;line-height:1.4}
.qdp-cardOwner{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}

/* Quota blocks: each merged group is a label row plus the track. */
.qdp-windows{flex-direction:column;gap:14px;display:flex}
.qdp-window{flex-direction:column;gap:6px;display:flex}
.qdp-windowHead{align-items:baseline;gap:8px;display:flex}
.qdp-windowLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:1.5}
.qdp-windowValue{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;white-space:nowrap}
.qdp-windowPct{color:var(--dsw-alias-label-primary);min-width:38px;text-align:right;font-size:12px;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums}
.qdp-bar{overflow:hidden;background:var(--dsw-alias-bg-layer-1);border-radius:999px;height:8px}
.qdp-barFill{background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
.qdp-barFillWarn{background:var(--dsw-alias-state-error-primary)}
.qdp-windowReset{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:1.5}

/* Badges. */
.qdp-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-brand-primary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;line-height:17px}
.qdp-badgeError{background:transparent;color:var(--dsw-alias-state-error-primary)}
.qdp-badgeMuted{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;max-width:220px;overflow:hidden;text-overflow:ellipsis}

/* Overall remaining + share line, ahead of the detail table. */
.qdp-totalLine{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.qdp-totalValue{font-size:22px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;margin-left:6px}
.qdp-totalSub{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums}

/* Detail table: every package, unmerged. Column heads are the settings
   shell's tertiary smallcaps; numbers are tabular; the mini bar rides under
   the figures in the same cell like the reference layout. */
.qdp-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.qdp-table th{text-align:left;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;line-height:1.5;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--dsw-alias-border-l2);padding:4px 8px}
.qdp-table td{padding:7px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);vertical-align:top}
.qdp-table tr:last-child td{border-bottom:0}
.qdp-num{min-width:150px}
.qdp-numText{display:block;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-bottom:3px}
.qdp-miniBar{display:block;height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.qdp-expiry{white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}

/* Variant switch: plain buttons, like the settings page's usage carousel. */
.qdp-tabs{flex-wrap:wrap;gap:6px;display:flex}
.qdp-tab{align-items:center;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;display:inline-flex;gap:6px}
.qdp-tab:hover:not(.qdp-tabActive){color:var(--dsw-alias-label-primary)}
.qdp-tabActive{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}

/* ------------------------------------------------- plugin card */
/* The Plugins-page configuration card. One rule set replaces the card's
   ~30 inline CSSProperties objects: same declarations, but themeable in one
   place, shareable between the unified card and any future surface, and
   free of the per-object fallback drift (identical rgba hexes had been
   restated by hand across objects). Dynamic values — progress widths,
   active-tab state, status-dot colour — stay inline on the element. */
.qdp-card{list-style:none;border-width:.5px;border-style:solid;border-color:var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}
.qdp-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.qdp-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
/* The disclosure header, shaped like workbuddy's .dsm-plugin-card-header:
   one full-width button so the whole row toggles, with the icon and the
   two-line title block on the left and the caret pushed right. */
.qdp-cardHeader{align-items:flex-start;gap:12px;width:100%;padding:14px 16px;border:0;background:none;color:inherit;cursor:pointer;text-align:left;display:flex}
.qdp-cardHead{flex-direction:column;align-items:flex-start;gap:4px;flex:1;min-width:0;display:flex}
.qdp-cardTitle{font-size:15px;line-height:1.4;font-weight:600;color:var(--dsw-alias-label-primary);text-align:left}
.qdp-cardDescription{font-size:13px;line-height:1.45;color:var(--dsw-alias-label-tertiary);text-align:left}
.qdp-cardIcon{flex:none;width:32px;height:32px;border-radius:7px;display:block}
/* A border-drawn caret rather than a host icon: the icon primitive's names
   differ across DSH lines (0.1.5 Outline14 vs 0.1.7 OutlineRegular), so no
   single static import serves both — the same reason workbuddy draws its own. */
.qdp-cardChevron{flex:none;width:9px;height:9px;margin-right:4px;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);transform:rotate(45deg);transition:transform .16s}
.qdp-cardChevronOpen{transform:rotate(225deg)}
/* No border-top: the host already draws a rule under the header row, so one
   here read as a second, doubled line across the card (and looked like an
   outer box around the panes). The rule belongs to whoever draws the header. */
.qdp-cardBody{margin:0 16px;padding:12px 0 8px;display:flex;flex-direction:column;gap:18px}
.qdp-h3{margin:0;font-size:13px;line-height:1.5;font-weight:600;color:var(--dsw-alias-label-primary)}
.qdp-body{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.qdp-error{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}
.qdp-row{align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;display:flex}
.qdp-status{align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary);display:flex}
.qdp-list{flex-direction:column;gap:18px;padding-top:2px;display:flex}
.qdp-group{flex-direction:column;gap:10px;display:flex}
.qdp-label{justify-content:space-between;gap:12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex}
.qdp-rate{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
/* Buttons. Primary fills the row's main action; danger is graded: quiet
   outline while armed, solid error fill once confirmed. */
.qdp-btn{box-sizing:border-box;padding:5px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1.5;cursor:pointer}
.qdp-btn:disabled{opacity:.4;cursor:default}
.qdp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-btnPrimary{border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.qdp-btnDanger{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-foreground)}
.qdp-btnDangerQuiet{color:var(--dsw-alias-state-error-primary)}
/* PAT entry row and its input. */
.qdp-patRow{align-items:center;gap:8px;flex-wrap:wrap;display:flex}
.qdp-patInput{box-sizing:border-box;flex:1;min-width:200px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.5}
/* Collapsible section inside the card body. */
.qdp-section{flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2);padding-top:10px;display:flex}
.qdp-sectionHeadRow{align-items:center;gap:8px;display:flex}
.qdp-sectionHead{font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:0;padding:4px 0;align-items:center;gap:8px;display:flex}
.qdp-sectionHead:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-sectionTitle{font-size:13px;font-weight:600;line-height:1.5}
.qdp-sectionActions{align-items:center;gap:6px;margin-left:auto;display:flex}
.qdp-sectionBody{flex-direction:column;gap:12px;padding-top:10px;display:flex}
/* The one level of variant tabs. */
.qdp-seg{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:3px;gap:4px;display:flex}
.qdp-segItem{flex:1;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:6px;padding:6px 12px;font:inherit;font-size:13px;line-height:18px;cursor:pointer;appearance:none;outline:none;color:var(--dsw-alias-label-tertiary);transition:all .16s ease;display:flex}
.qdp-segItem:hover{color:var(--dsw-alias-label-primary)}
.qdp-segItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-segItemActive{border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-weight:500}
/* Context preference + model rows. */
.qdp-contextPref{align-items:flex-start;gap:9px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;padding:10px 12px;display:flex}
.qdp-contextPrefCopy{flex-direction:column;gap:2px;display:flex}
.qdp-contextPicker{align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;display:flex}
/* Column headings for the model list, sitting on the divider the user drew
   above the list: the rule separates the refresh toolbar from the list, and
   the two captions name the columns the rows are laid out in. */
.qdp-modelColumns{border-top:.5px solid var(--dsw-alias-border-l2);align-items:center;justify-content:space-between;gap:12px;padding:8px 12px 6px;display:flex;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
/* Model rows as one framed list: rows are separated by hairlines INSIDE a
   single rounded frame (workbuddy's list shape) rather than each being its
   own filled chip, which read as a stack of unrelated boxes. The frame owns
   the radius and the border; the rows own the dividers. */
.qdp-modelList{border:.5px solid var(--dsw-alias-border-l4);border-radius:10px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}
.qdp-modelRow{align-items:flex-start;justify-content:space-between;gap:12px;background:none;border-radius:0;padding:10px 12px;display:flex}
.qdp-modelRow + .qdp-modelRow{border-top:.5px solid var(--dsw-alias-border-l2)}
/* The row's left half: the visibility checkbox plus the two-line name/id
   block. These classes were referenced by the card from the start but never
   had rules, so the block rendered with browser defaults; stated properly
   here as part of the framed-list restyle. */
.qdp-modelEnable{align-items:center;gap:9px;flex:1;min-width:0;cursor:pointer;display:flex}
.qdp-modelEnable input{flex:none;margin:0;cursor:pointer}
.qdp-modelCopy{flex-direction:column;gap:1px;min-width:0;display:flex}
.qdp-modelName{font-size:13px;line-height:1.4;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The per-model window slider, shaped like Qoder's own control: a light
   green wash filling the groove up to a slim green bar handle. Green here is
   the success tone Qoder uses for this control, not the blue brand fill. */
.qdp-windowSlider{flex-direction:column;gap:4px;flex:none;width:170px;display:flex}
.qdp-windowTrack{position:relative;height:18px;display:flex;align-items:center}
.qdp-windowTrack::before{content:"";position:absolute;left:0;right:0;height:8px;border-radius:3px;background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l2)}
/* The wash runs from the left edge to the handle, so the travel in effect
   reads at a glance even when the handle sits at stop 0. */
.qdp-windowFill{position:absolute;left:0;height:8px;border-radius:3px;background:var(--dsw-alias-state-success-primary,#3e8e5a);opacity:.22}
/* The handle is a slim vertical bar (Qoder's), not a round dot. It is inset
   by half its width so stop 0 sits ON the left edge instead of hanging half
   outside the track — which is what made it look unrendered at 0. */
.qdp-windowKnob{position:absolute;width:4px;height:16px;border-radius:2px;background:var(--dsw-alias-state-success-primary,#3e8e5a);transform:translateX(-2px)}
.qdp-windowInput{position:absolute;left:0;right:0;width:100%;height:18px;margin:0;opacity:0;cursor:pointer;-webkit-appearance:none;appearance:none}
.qdp-windowInput:disabled{cursor:default}
.qdp-windowTicks{position:relative;height:14px;font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.qdp-windowTick{position:absolute;transform:translateX(-50%);white-space:nowrap}
/* The origin marker: the track starts at 0 for every model, and the user
   asked for that start to be visible without printing the number 0. */
.qdp-windowTickMark{display:inline-block;width:1px;height:4px;background:var(--dsw-alias-border-l4)}
.qdp-windowValue{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.qdp-track{height:8px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}
.qdp-checkinRow{align-items:center;padding:6px 0;font-size:13px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex}
.qdp-checkinHead{border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:6px;font-size:12px;color:var(--dsw-alias-label-tertiary);display:flex}
.qdp-logList{flex-direction:column;gap:6px;display:flex}
/* Usage & check-in panel: one bordered surface, usage above a divider,
   check-in below (workbuddy's credit-panel shape, restated for qdp-). */
.qdp-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:14px;gap:12px;display:flex;flex-direction:column}
.qdp-panelDivide{border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px}
.qdp-panelHead{align-items:baseline;justify-content:space-between;gap:12px;display:flex}
.qdp-panelTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
.qdp-panelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}
.qdp-checkinLine{align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;display:flex}
.qdp-checkinState{align-items:center;gap:8px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex;min-width:0}
/* Bottom tab strip: two panes side by side, an underline marks the active
   one. Quiet pills would compete with the panel headings above. */
.qdp-paneTabs{gap:18px;border-bottom:1px solid var(--dsw-alias-border-l2);margin-top:2px;display:flex}
.qdp-paneTab{font:inherit;font-size:13px;line-height:20px;cursor:pointer;background:0 0;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary);padding:6px 2px;margin-bottom:-1px}
.qdp-paneTab:hover{color:var(--dsw-alias-label-primary)}
.qdp-paneTab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.qdp-paneTabActive{border-bottom-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);font-weight:600}
/* The merged model pane: header row carries the refresh control; each row
   states its own context capacity beside the enable toggle. */
.qdp-modelHead{align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;display:flex}
.qdp-modelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap}
/* Per-model context picker: a compact select like workbuddy's account
   picker, sharing the select-wrap caret pattern. */
/* Variant tabs with an enable checkbox per side (workbuddy tab-switch). */
.qdp-segCell{align-items:center;gap:2px;flex:1;min-width:0;display:flex}
.qdp-segSwitch{display:inline-flex;align-items:center;flex:none;padding:0 8px 0 2px;cursor:pointer}
.qdp-segSwitch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary)}
.qdp-segSwitch input:disabled{opacity:.4;cursor:default}
.qdp-segOff{opacity:.55}
/* Account box + PAT box (workbuddy usage-account shape). */
.qdp-accountBox{align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-2);padding:12px 14px;display:flex}
.qdp-accountState{align-items:center;gap:10px;font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary);display:flex}
.qdp-accountExpiry{padding-left:19px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.qdp-patBox{align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3);padding:8px 12px;display:flex}
.qdp-patBoxCopy{flex-direction:column;gap:1px;min-width:0;display:flex}
.qdp-patBoxName{color:var(--dsw-alias-label-primary);font-size:12px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qdp-patBoxMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
/* Settings listed flat on the Usage pane: no fold, just grouped rows. */
.qdp-settingsFlat{border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;gap:4px;display:flex;flex-direction:column}
.qdp-settingsTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
/* 可用额度与最近领取并列两栏:workbuddy 的 credit-panels 布局,窄屏回落单列。 */
.qdp-twoUp{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:stretch;display:grid}
@media (max-width:760px){.qdp-twoUp{grid-template-columns:1fr}}
/* 领取台账的一行:左边日期,右边到期情况(与需求 4 的排版一致)。 */
.qdp-ledgerRow{align-items:baseline;justify-content:space-between;gap:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:flex}
/*
 * 台账本体占满左框的剩余高度,超出就滚动而不是把框撑长(需求 1:
 * 界面能显示几条显示几条)。行高 18px + 行距 6px,9 行 ≈ 216px;
 * 底部的「3 天内到期」小结只占自己一行,高度都留给上面的列表。
 */
.qdp-ledgerList{max-height:216px;overflow-y:auto}
.qdp-ledgerDate{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}
.qdp-ledgerAmount{flex:none;color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}
.qdp-ledgerExpiry{margin-left:auto;color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}
.qdp-ledgerExpired{color:var(--dsw-alias-state-error-primary)}
/* 右侧额度框里的领取按钮:占满整行、贴在剩余额度/进度下面(需求 4)。 */
.qdp-claimBtn{width:100%;justify-content:center}
/* 左框底部的到期小结行,与它上面的台账行用一条分隔线断开。 */
.qdp-ledgerFoot{border-top:1px solid var(--dsw-alias-border-l2);padding-top:10px;align-items:baseline;justify-content:space-between;gap:10px;display:flex}
.qdp-ledgerFootValue{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}

@media (prefers-reduced-motion:reduce){.qdp-footFill,.qdp-barFill{transition:none}}
`;
		//#endregion
		//#region src/client/locales.ts
		/** Plugin-card copy registered under the settings.qoder locale namespace. */
		const en = {
			title: "Qoder",
			intro: "Use the models from your Qoder (China) account directly in DSH — paste a Personal Access Token, no browser sign-in flow.",
			titleAI: "Qoder Global",
			introAI: "Use the models from your Qoder Global account directly in DSH — paste a Personal Access Token, no browser sign-in flow.",
			unifiedTitle: "Qoder",
			unifiedIntro: "Manage Qoder (China) and Qoder Global models, credentials, and sidebar quota displays.",
			variantTabCN: "China",
			variantTabGlobal: "Global",
			expand: "Expand",
			collapse: "Collapse",
			loading: "Loading account…",
			signedOut: "Not signed in",
			signedOutHint: "Save a Personal Access Token to use Qoder (China) models in DSH.",
			signedOutHintAI: "Save a Personal Access Token to use Qoder Global models in DSH.",
			patHeading: "Personal Access Token",
			patGuide: "Generate a PAT in your qoder.com.cn account settings (Account → Personal Access Token), then paste it here.",
			patGuideAI: "Generate a PAT in your qoder.com account settings (Account → Personal Access Token), then paste it here.",
			patPlaceholder: "Paste the PAT generated on qoder.com.cn",
			patPlaceholderAI: "Paste the PAT generated on qoder.com",
			patSave: "Save",
			patSaving: "Validating and saving…",
			patSaved: "PAT saved.",
			patSaveFailed: "Save failed: {message}",
			patInvalid: "That PAT was rejected — generate a new one in your account settings and try again.",
			patReplace: "Replace PAT",
			patClear: "Clear PAT",
			patClearing: "Clearing PAT…",
			signedIn: "Signed in",
			patSourceCard: "source: saved via this card",
			patSourceEnv: "source: environment variable",
			patSourceCli: "source: command line",
			patSavedAt: "saved {time}",
			patTail: "ends {tail}",
			creditsHeading: "Available credit",
			tabStatus: "Status",
			tabContext: "Context window",
			tabModels: "Model visibility",
			tabDetails: "Credit details",
			tabCheckIn: "Check-in",
			paneUsage: "Auto check-in",
			variantEnable: "Enabled",
			accountSignedInAs: "Signed in: {name}",
			patBoxLabel: "Personal access token (PAT)",
			patRemove: "Remove",
			paneModels: "Models",
			modelsMergedHeading: "Models & context window",
			modelsMergedHint: "Toggle visibility per model; its context capacity (and the larger window it can reach) is stated beside it.",
			cardExpand: "Expand",
			cardCollapse: "Collapse",
			ledgerHeading: "Recent claims",
			ledgerExpiringHeading: "Expiring within {days} days",
			ledgerEmpty: "No claims recorded in this range.",
			ledgerExpiresAt: "Expires {date}",
			ledgerExpired: "Expired",
			ledgerExpiryUnknown: "Expiry unknown",
			checkInLogTime: "Check-in time",
			checkInLogResult: "Result",
			checkInLogAmount: "Credits",
			checkInLogEmpty: "No check-in logs recorded yet.",
			checkInLogShow: "Logs",
			checkInLogHide: "Hide log",
			checkInNow: "Claim now",
			checkInClaimedToday: "Claimed today",
			checkInChecking: "Claiming…",
			checkInRefresh: "Refresh",
			checkInRefreshing: "Refreshing…",
			checkInClear: "Clear logs",
			checkInClearing: "Clearing…",
			checkInNextRun: "Next automatic claim: {time}",
			creditsDetailHeading: "By package",
			creditsUsed: "Used this cycle: {percent}%",
			creditsUsedUnlimited: "This cycle: no usage cap",
			creditsNoData: "No data found",
			unlimitedQuota: "Unlimited",
			cycleResetAt: "Resets {time}",
			percentRemaining: "{percent}% remaining",
			percentUnknown: "Remaining share unknown",
			exactRemaining: "{remain} / {size} remaining",
			creditPackageUnknownSize: "{remain} remaining",
			creditsError: "Credit unavailable: {message}",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			refreshModels: "Refresh from Qoder",
			refreshingModels: "Refreshing models…",
			jobTokenRefreshed: "Job token was auto-refreshed at {time} (upstream rejected the old one; the message recovered).",
			catalogLive: "Model list updated {time}",
			catalogSaved: "Showing the saved model list from {time}",
			catalogFallback: "Showing the built-in model list (not yet updated from Qoder)",
			catalogError: "Last update failed: {message}",
			requestFailed: "Request failed",
			statusRefreshFailed: "Refresh failed: {message} — showing the last known state",
			statusResponseInvalid: "Qoder returned an unreadable status reply",
			accountHeading: "Account",
			modelsHeading: "Model visibility",
			modelsSubtitle: "Choose which models are exposed to the DeepSeek Harness model selector.",
			modelsSearchPlaceholder: "Search by model name or ID…",
			modelsSelectAll: "Select all",
			modelsDeselectAll: "Deselect all",
			modelsEnableSelected: "Enable selected",
			modelsDisableSelected: "Disable selected",
			modelsEnabled: "Enabled",
			modelsDisabled: "Disabled",
			modelsBatchActions: "Batch actions",
			modelsSelectedCount: "{count} selected",
			modelsNoModels: "No models available.",
			modelsNoMatch: "No models matching \"{query}\".",
			modelNameColumn: "Model name",
			contextHeading: "Context window",
			contextUpTo: "up to {size}",
			contextDefault: "default {size}",
			useMaximumContextWindow: "Use the largest declared context window",
			useMaximumContextWindowHint: "When on, models that declare a larger window are requested at it; when off, at their default.",
			probeLabel: "Reasoning levels",
			probeTooltipIdle: "Detect the reasoning levels {model} accepts",
			probeTooltipVerified: "Accepted levels: {levels} · click to detect again",
			probeTooltipNotValidating: "This model does not check the effort parameter",
			probeTooltipRetry: "Detection did not complete · click to retry",
			probeBubbleBody: "Send test requests to confirm the available reasoning levels. May consume a small amount of credit.",
			probeConfirmAction: "Confirm",
			probeNoteVerified: "Detected: {levels}",
			probeNoteNotValidating: "This model does not check the effort parameter",
			probeNoteUnknown: "Detection did not complete",
			probeNoteDismiss: "Got it",
			probeHeading: "Reasoning effort detection",
			probeResultNoLevels: "No tested levels were accepted.",
			probeIntro: "Some models reason but declare no selectable effort levels. Detecting which levels a model accepts sends a few real requests that may consume credit.",
			probeConsentHint: "Each detection sends test requests to one model to confirm its available reasoning levels, and may consume a small amount of credit.",
			probeStart: "Detect",
			probeRedetect: "Detect again",
			probeRunning: "Detecting {model}…",
			probeRunningGeneric: "Detecting…",
			probeClear: "Clear detected results",
			probeCandidates: "Detectable models: {count}",
			probeConfirmBody: "Send test requests to {model} to confirm its available reasoning levels. May consume a small amount of credit.",
			cancel: "Cancel",
			probeResultVerified: "Verified levels: {levels}",
			probeResultNotValidating: "This model does not check the effort parameter",
			probeResultUnknown: "Detection did not complete",
			probeResultAt: "Detected {time}",
			probeResultEmpty: "No detectable models right now.",
			probeFailed: "Detection failed: {message}",
			quotaSettingsTitle: "Qoder sidebar display",
			quotaSettingsHeading: "Sidebar & check-in settings",
			patClearConfirm: "Clear the saved PAT? This account signs out.",
			patClearConfirmYes: "Yes, clear it",
			quotaSettingsIntro: "Show remaining credit beside the sidebar Settings seat. Each toggle needs its variant to have a saved PAT.",
			quotaToggleCN: "Show China credit card",
			quotaToggleGlobal: "Show global credit card",
			quotaToggleHint: "Show this account’s remaining credit in the sidebar footer.",
			autoCheckInCN: "Qoder (China) daily auto check-in (100 Credits)",
			autoCheckInGlobal: "Qoder Global (International) daily auto check-in",
			autoCheckInHintCN: "Automatically check in daily to claim 100 Credits for the China account.",
			autoCheckInHintGlobal: "Automatically check in daily to claim available perks for the Global account.",
			checkInTimeCN: "Check-in time (China)",
			checkInTimeGlobal: "Check-in time (Global)",
			checkInTimeHint: "The moment the automatic check-in runs each day, in UTC+8.",
			autoCheckInStatusClaimed: "Checked in today (+{amount} Credits)",
			autoCheckInStatusAlready: "Already checked in today",
			autoCheckInStatusNoCampaign: "No active benefit campaign today",
			autoCheckInStatusError: "Auto check-in error: {message}",
			quotaSignInRequired: "Save a PAT for this variant first to enable this card.",
			quotaPollLabel: "Refresh interval",
			quotaPollHint: "Applies to both quota cards. Longer is kinder to the billing endpoint.",
			quotaPollUnit: "min",
			quotaSettingsSave: "Save",
			quotaSettingsSaving: "Saving…",
			quotaSettingsDiscard: "Discard",
			quotaSettingsDirty: "Unsaved changes",
			quotaSettingsInvalid: "A value is invalid — fix it before saving",
			quotaSettingsSaveFailed: "Save did not land — retry",
			quotaSettingsSavedHint: "Saved",
			quotaCardCN: "Qoder credit",
			quotaCardGlobal: "Qoder Global credit",
			quotaUnknownTotal: "total unknown",
			quotaUnlimited: "Unlimited",
			quotaExpires: "Expires",
			quotaNoExpiry: "No expiry",
			quotaError: "Credit unavailable",
			quotaNotSignedIn: "Save a PAT to see the remaining credit",
			quotaUpdated: "Updated",
			quotaDashboardTitle: "Qoder quota",
			quotaDashboardSubtitle: "Remaining credit by package, per product",
			quotaRefresh: "Refresh",
			quotaRefreshing: "Refreshing…",
			quotaClose: "Close",
			quotaByPackage: "By package",
			quotaTotal: "Total",
			quotaTotalRemain: "Remaining",
			quotaTotalShare: "{percent} of this cycle’s granted total ({remain} / {size})",
			quotaCycleUsed: "Used this cycle: {percent}%",
			quotaColPackage: "Package",
			quotaColRemain: "Remaining / Total",
			quotaColExpiry: "Expires"
		};
		const zh = {
			title: "Qoder（国内版）",
			intro: "保存个人访问令牌（PAT）后，即可在 DSH 中直接使用 Qoder 国内版的模型。",
			titleAI: "Qoder Global（国际版）",
			introAI: "保存个人访问令牌（PAT）后，即可在 DSH 中直接使用 Qoder Global 的模型。",
			unifiedTitle: "Qoder",
			unifiedIntro: "统一管理 Qoder（国内版）与 Qoder Global（国际版）模型、凭证及侧栏额度展示。",
			variantTabCN: "国内版",
			variantTabGlobal: "国际版",
			expand: "展开",
			collapse: "收起",
			loading: "正在读取账号…",
			signedOut: "未登录",
			signedOutHint: "填入个人访问令牌（PAT）后即可在 DSH 中使用 Qoder 国内版的模型。",
			signedOutHintAI: "填入个人访问令牌（PAT）后即可在 DSH 中使用 Qoder Global 的模型。",
			patHeading: "个人访问令牌（PAT）",
			patGuide: "请先在 qoder.com.cn 的账号设置（账号 → 个人访问令牌）中生成 PAT，再粘贴到下方输入框。",
			patGuideAI: "请先在 qoder.com 的账号设置（账号 → 个人访问令牌）中生成 PAT，再粘贴到下方输入框。",
			patPlaceholder: "粘贴在 qoder.com.cn 生成的 PAT",
			patPlaceholderAI: "粘贴在 qoder.com 生成的 PAT",
			patSave: "保存",
			patSaving: "校验并保存中…",
			patSaved: "PAT 已保存。",
			patSaveFailed: "保存失败：{message}",
			patInvalid: "PAT 无效或已过期 — 请到账号设置重新生成后再试。",
			patReplace: "更换 PAT",
			patClear: "清除 PAT",
			patClearing: "正在清除 PAT…",
			signedIn: "已登录",
			patSourceCard: "来源：卡片保存",
			patSourceEnv: "来源：环境变量",
			patSourceCli: "来源：命令行",
			patSavedAt: "保存于 {time}",
			patTail: "尾号 {tail}",
			creditsHeading: "可用额度",
			tabStatus: "状态",
			tabContext: "上下文窗口",
			tabModels: "模型开关",
			tabDetails: "额度明细",
			tabCheckIn: "签到",
			paneUsage: "自动签到",
			variantEnable: "启用",
			accountSignedInAs: "已登录：{name}",
			patBoxLabel: "个人访问令牌（PAT）",
			patRemove: "删除",
			paneModels: "模型",
			modelsMergedHeading: "模型与上下文窗口",
			modelsMergedHint: "逐模型控制可见与可用；旁边标注该模型的上下文容量及其可扩展的最大窗口。",
			cardExpand: "展开",
			cardCollapse: "收起",
			ledgerHeading: "最近领取",
			ledgerExpiringHeading: "{days} 天内到期",
			ledgerEmpty: "该区间内暂无领取记录。",
			ledgerExpiresAt: "有效期至 {date}",
			ledgerExpired: "已过期",
			ledgerExpiryUnknown: "有效期未知",
			checkInLogTime: "签到时间",
			checkInLogResult: "签到结果",
			checkInLogAmount: "获得额度",
			checkInLogEmpty: "暂无签到日志记录。",
			checkInLogShow: "日志",
			checkInLogHide: "收起日志",
			checkInNow: "立即领取",
			checkInClaimedToday: "今日已签到",
			checkInChecking: "正在领取…",
			checkInRefresh: "刷新",
			checkInRefreshing: "正在刷新…",
			checkInClear: "清空日志",
			checkInClearing: "正在清空…",
			checkInNextRun: "下次自动领取：{time}",
			creditsDetailHeading: "按套餐",
			creditsUsed: "本轮已用 {percent}%",
			creditsUsedUnlimited: "本轮：无使用上限",
			creditsNoData: "未找到数据",
			unlimitedQuota: "不限额",
			cycleResetAt: "重置时间：{time}",
			percentRemaining: "剩余 {percent}%",
			percentUnknown: "剩余占比未知",
			exactRemaining: "剩余 {remain} / {size}",
			creditPackageUnknownSize: "剩余 {remain}",
			creditsError: "额度查询失败：{message}",
			refresh: "刷新",
			refreshing: "正在刷新…",
			refreshModels: "从 Qoder 刷新",
			jobTokenRefreshed: "jobToken 已于 {time} 自动刷新（上游拒绝了旧令牌，消息已自动恢复）。",
			refreshingModels: "正在刷新模型…",
			catalogLive: "模型列表更新于 {time}",
			catalogSaved: "当前显示已保存的模型列表，更新于 {time}",
			catalogFallback: "当前显示内置模型列表（尚未从 Qoder 更新）",
			catalogError: "上次更新失败：{message}",
			requestFailed: "请求失败",
			statusRefreshFailed: "刷新失败：{message} — 当前显示的是上次成功获取的状态",
			statusResponseInvalid: "Qoder 返回的状态数据无法识别",
			accountHeading: "账号",
			modelsHeading: "模型开关",
			modelsSubtitle: "控制哪些模型在 DeepSeek Harness 模型选择器中可见并可供调用。",
			modelsSearchPlaceholder: "按模型名称或 ID 搜索…",
			modelsSelectAll: "全选",
			modelsDeselectAll: "取消全选",
			modelsEnableSelected: "批量开启",
			modelsDisableSelected: "批量关闭",
			modelsEnabled: "已开启",
			modelsDisabled: "已关闭",
			modelsBatchActions: "批量操作",
			modelsSelectedCount: "已选 {count} 项",
			modelsNoModels: "暂无可配置的模型。",
			modelsNoMatch: "未找到匹配“{query}”的模型。",
			modelNameColumn: "模型名称",
			contextHeading: "上下文窗口",
			contextUpTo: "最高 {size}",
			contextDefault: "默认 {size}",
			useMaximumContextWindow: "使用上游声明的最大上下文窗口",
			useMaximumContextWindowHint: "勾选后，声明了更大窗口的模型按最大窗口请求；不勾选则按默认窗口。",
			probeLabel: "推理等级",
			probeTooltipIdle: "检测 {model} 可用的推理档位",
			probeTooltipVerified: "已接受：{levels} · 点击可重新检测",
			probeTooltipNotValidating: "该模型不校验该参数",
			probeTooltipRetry: "检测未完成 · 点击重试",
			probeBubbleBody: "发送探测请求以确认可用推理档位。可能消耗少量积分。",
			probeConfirmAction: "确认检测",
			probeNoteVerified: "已检测：{levels}",
			probeNoteNotValidating: "该模型不校验该参数",
			probeNoteUnknown: "检测未完成",
			probeNoteDismiss: "知道了",
			probeHeading: "推理档位检测",
			probeResultNoLevels: "本次测试的档位均未被接受。",
			probeIntro: "部分模型具备思考能力，但没有声明可选档位。检测会发送少量真实请求，可能消耗积分。",
			probeConsentHint: "每次检测会向该模型发送探测请求，以确认可用推理档位，可能消耗少量积分。",
			probeStart: "开始检测",
			probeRedetect: "重新检测",
			probeRunning: "正在检测 {model}…",
			probeRunningGeneric: "正在检测…",
			probeClear: "清除已探测结果",
			probeCandidates: "可检测模型：{count} 个",
			probeConfirmBody: "向 {model} 发送探测请求，以确认可用推理档位。可能消耗少量积分。",
			cancel: "取消",
			probeResultVerified: "已验证接受的档位：{levels}",
			probeResultNotValidating: "该模型不校验该参数",
			probeResultUnknown: "检测未完成",
			probeResultAt: "检测于 {time}",
			probeResultEmpty: "当前没有可检测的模型。",
			probeFailed: "检测失败：{message}",
			quotaSettingsTitle: "Qoder 侧栏展示",
			quotaSettingsHeading: "侧栏与签到设置",
			patClearConfirm: "确定清除已保存的 PAT？该账号将登出。",
			patClearConfirmYes: "确认清除",
			quotaSettingsIntro: "在侧栏设置项旁展示剩余额度。开关需要对应产品已保存 PAT。",
			quotaToggleCN: "展示国内版额度",
			quotaToggleGlobal: "展示国际版额度",
			quotaToggleHint: "在侧栏底部展示该账号的剩余额度。",
			autoCheckInCN: "Qoder（国内版）每日自动签到",
			autoCheckInGlobal: "Qoder Global（国际版）每日自动签到",
			autoCheckInHintCN: "每天自动签到，为国内版账号领取 100 Credits 算力额度。",
			autoCheckInHintGlobal: "每天自动签到，为国际版账号领取可用福利额度。",
			checkInTimeCN: "签到时间（国内版）",
			checkInTimeGlobal: "签到时间（国际版）",
			checkInTimeHint: "每天执行自动签到的时刻，按北京时间（UTC+8）。",
			autoCheckInStatusClaimed: "今日已自动签到（+{amount} Credits）",
			autoCheckInStatusAlready: "今日已完成签到",
			autoCheckInStatusNoCampaign: "今日无可用签到福利活动",
			autoCheckInStatusError: "自动签到出错：{message}",
			quotaSignInRequired: "请先为该变体保存 PAT，再开启此开关。",
			quotaPollLabel: "刷新间隔",
			quotaPollHint: "对两张额度卡片同时生效。间隔越长对计费接口越友好。",
			quotaPollUnit: "分钟",
			quotaSettingsSave: "保存",
			quotaSettingsSaving: "保存中…",
			quotaSettingsDiscard: "放弃更改",
			quotaSettingsDirty: "有未保存的更改",
			quotaSettingsInvalid: "有数值不合法，请修正后再保存",
			quotaSettingsSaveFailed: "保存未生效，请重试",
			quotaSettingsSavedHint: "已保存",
			quotaCardCN: "Qoder 额度",
			quotaCardGlobal: "Qoder Global 额度",
			quotaUnknownTotal: "总量未知",
			quotaUnlimited: "不限量",
			quotaExpires: "到期",
			quotaNoExpiry: "无到期时间",
			quotaError: "额度信息不可用",
			quotaNotSignedIn: "保存 PAT 后显示剩余额度",
			quotaUpdated: "更新于",
			quotaDashboardTitle: "Qoder 额度",
			quotaDashboardSubtitle: "按套餐展示各产品的剩余额度",
			quotaRefresh: "刷新",
			quotaRefreshing: "刷新中…",
			quotaClose: "关闭",
			quotaByPackage: "按套餐",
			quotaTotal: "合计",
			quotaTotalRemain: "剩余额度",
			quotaTotalShare: "占本轮总额度 {percent}（{remain} / {size}）",
			quotaCycleUsed: "本轮已用 {percent}%",
			quotaColPackage: "资源包",
			quotaColRemain: "剩余 / 总量",
			quotaColExpiry: "到期时间"
		};
		//#endregion
		//#region src/client/index.tsx
		/** Browser half: Qoder account status, quota cards, and plugin settings. */
		/** Stable browser-plugin name. */
		const name = "dsh-connect-qoder-x-client";
		/**
		* Client services this bundle requires BEFORE it activates.
		*
		* DSH 0.1.2 removed `@deepseek-ai/dsh-client-runtime` (the package that used to
		* hold the browser `ClientContext` alias and the `slots` service). The services
		* this card relies on now come from narrower packages: the `slots` registry
		* moved to `@deepseek-ai/dsh-client-ui-renderer` and `locale` stayed in
		* `@deepseek-ai/dsh-client-locale`. Both are named in the package's
		* `dsh.client.inject` list.
		*
		* NOT declared here: the settings services. `settingsScope` (0.1.5) does not
		* exist at all on 0.1.7 — a static service dependency on it is what left this
		* plugin's client activation pending forever — and `configForms` (0.1.7) does
		* not exist on 0.1.5. Neither is used any more (see `OwnQuotaSettingsScope`),
		* so no callback waits on them either.
		*
		* ALSO NOT declared here: `ui-plugin-manager`. The two plugin-configuration
		* seats this card registers into (`plugins.row.config`, `plugins.bundle.config`)
		* are declared by that package, but the registrations go through
		* `ctx.slots.inject`, which is a CALLBACK on a slot NAME — a deployment that
		* never composes the Plugins page simply never calls back, exactly like the
		* optional services above. A static dependency would instead gate this whole
		* client on a package the plugin does not need to serve models.
		*/
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.session"
		];
		/** The status routes per variant id (mirrors the host's locked route table). */
		const VARIANT_STATUS = {
			qoder: QODER_STATUS_PATH,
			"qoder-global": QODER_GLOBAL_STATUS_PATH
		};
		/**
		* The profile ROW ID this plugin runs as — the id its own patch declares.
		*
		* `cordis.patch.yml` inserts `- id: llm-qoder-x, name: dsh-connect-qoder-x`, so
		* the Plugins page reports this plugin's row as `llm-qoder-x`. The browser half
		* needs it for exactly one thing: the right half of {@link ROW_CONFIG_KEY}.
		*
		* A profile that composes this bundle under some OTHER id — the package name is
		* what an entry without an explicit id falls back to — would dispatch a key this
		* constant does not match, and the card simply would not appear on that row.
		* There is no partial failure mode: a keyed slot nobody dispatches renders
		* nothing.
		*/
		const ENTRY_ID = "llm-qoder-x";
		/**
		* The two 0.1.7 seats this card registers into, on the Plugins page.
		*
		* Both are KEYED slots declared by `@deepseek-ai/dsh-client-ui-plugin-manager`
		* (`packages/client/ui-plugin-manager/src/client/slot-contract.ts`) and both
		* receive the same card component; only the key differs:
		*
		*   - `plugins.row.config`, keyed `<package name>#<row id>`, is the PRIMARY seat.
		*     Hitting it is what makes the Plugins page put a 「配置」 control on this
		*     plugin's row, and clicking that opens this card as the row's own page —
		*     the 「插件 → 点插件名 → 展开设置」 path.
		*   - `plugins.bundle.config`, keyed by PACKAGE NAME alone, renders inline on the
		*     package detail page between the description and the row list: the same
		*     card for a reader who opened the package rather than the row.
		*
		* This replaces the `settings.section` container plus the community-private
		* `plugin-settings.item` child that the three connect plugins used to rendezvous
		* in. That rendezvous is gone: the slot is a normal keyed seat, the owner
		* dispatches it, and no sibling plugin has to agree on an id.
		*/
		const ROW_CONFIG_SLOT = "plugins.row.config";
		const BUNDLE_CONFIG_SLOT = "plugins.bundle.config";
		/**
		* This plugin's package name — the `plugins.bundle.config` key, and the left half
		* of the `plugins.row.config` key.
		*/
		const PACKAGE_NAME = "dsh-connect-qoder-x";
		/**
		* The complete `plugins.row.config` key.
		*
		* The owner derives it as `` `${pkg.name}#${row.rowId}` `` where `rowId` comes
		* from the id the bundle's patch declares (`plugin-manager/lib/index.js`:
		* `rows.push({ rowId: row.id, ... })`, fed by `composeEntries`), and this
		* plugin's patch inserts its row as `id: llm-qoder-x`. Built from the two
		* constants rather than written as one literal so a rename cannot desync them
		* from {@link ENTRY_ID} and {@link PACKAGE_NAME}.
		*/
		const ROW_CONFIG_KEY = `${PACKAGE_NAME}#${ENTRY_ID}`;
		/**
		* Register card copy, the unified Qoder card on both Plugins-page seats, and the
		* sidebar quota cards.
		*
		* The entire body is wrapped so that a DSH slot-API breaking change (for
		* example the rc.6→rc.7 `id`→`key` / `order`→`priority` rename) degrades
		* to a `console.error` instead of throwing into the DSH loader and raising
		* the red "Failed to load plugins" banner. The host provider keeps working:
		* the `qoder` model channel is unaffected, and `dsh-connect-qoder-x
		* status` reports host health via the heartbeat file.
		*
		* NOTE: the try/catch boundary of this function is mirrored (duplicated) in
		* `tests/client-fallback.spec.ts`, because the real client entry imports
		* browser-only DSH packages that cannot load in the Node test environment.
		* That test therefore does not import this function — it replicates its
		* shape. If you change the guarded body or the `console.error` message here,
		* update the mirrored `apply()` in that spec too, or the fallback test will
		* silently diverge from this real implementation.
		*/
		function apply(ctx) {
			try {
				const namespace = "settings.qoder";
				ctx.effect(() => ctx.locale.register(namespace, {
					zh,
					en
				}), "dsh-connect-qoder-x: settings copy");
				const t = ctx.locale.bind(namespace);
				/**
				* The bound quota settings face, filled in as soon as this plugin's own
				* settings file answers (see {@link OwnQuotaSettingsScope}).
				*
				* It is bound on a STORED fact rather than when the card's inject factory
				* first runs: the factory only executes while the Plugins page renders, so a
				* fresh page load read no toggles and rendered no sidebar card until the user
				* opened that page. The face's subscription mirrors every accepted snapshot
				* (toggles + interval) into the shared store the sidebar cards and the
				* dashboard read; a deployment where the host route never answers never
				* binds, and the sidebar cards stay hidden.
				*/
				let quotaScope;
				const adoptQuotaScope = (scope) => {
					quotaScope = scope;
					const applySnapshot = () => {
						const value = scope.getSnapshot().value;
						setQuotaToggles(value?.sidebarQuotaCN === true, value?.sidebarQuotaGlobal === true);
						if (typeof value?.quotaPollMs === "number") setQuotaPollMs(value.quotaPollMs);
					};
					applySnapshot();
					scope.subscribe(applySnapshot);
				};
				/**
				* The card's inject face. One face serves both seats: the card is the same
				* component either way, and it reads `view` from its PROPS (the owner's
				* contract), not from here.
				*/
				const cardFace = () => ({
					t,
					scope: quotaScope,
					signedIn: () => quotaSignInState(),
					unified: true
				});
				/**
				* Register the unified Qoder card on both Plugins-page configuration seats.
				*
				* Two registrations, one component, keys derived above. They are independent
				* — a deployment that declares only one of the two seats gets the card on
				* that one and simply never calls back for the other — so neither failure
				* can suppress the other.
				*/
				const registerCard = (slot, key) => {
					try {
						ctx.slots.inject(slot, () => ctx.slots.register({
							name: slot,
							key,
							inject: cardFace
						}, QoderPluginCard));
					} catch (error) {
						console.error(`[dsh-connect-qoder-x] card slot "${slot}" failed to register (host provider unaffected):`, error);
					}
				};
				registerCard(ROW_CONFIG_SLOT, ROW_CONFIG_KEY);
				registerCard(BUNDLE_CONFIG_SLOT, PACKAGE_NAME);
				/**
				* 插件自有配置（`<profile>/.dsh-connect-qoder-x/settings.json`）：两条宿主线的
				* 读写都走宿主半的 settings face，不再经过 settingsScope / configForms。
				*
				* 0.1.7 的 configForms 写入会整树 reconcile + fiber 热重载（每次约
				* 1~1.5 秒，且每次保存都刷新所有客户端镜像）；自有文件写入是本地毫秒级
				* 原子写。卡片注册无条件进行：scope 在启动时载入，迟到也不会漏掉 UI。
				*/
				const ownQuotaScope = new OwnQuotaSettingsScope();
				ownQuotaScope.load();
				adoptQuotaScope(ownQuotaScope);
				const QUOTA_PANEL_ID = "qoder-quota-panel";
				const CONVERSATION_PANEL_ID = "conversation";
				const dashboardDocuments = {
					cn: void 0,
					global: void 0
				};
				let dashboardFetchedAt;
				let dashboardLoading = false;
				let dashboardRequestedPath = QODER_STATUS_PATH;
				/** Whether the dashboard is the CURRENT center panel (its mount owns this). */
				let quotaPanelOpen = false;
				const dashboardListeners = /* @__PURE__ */ new Set();
				/**
				* The observable source the dashboard reads through the inject face's
				* `hooks` compartment. The renderer caches an inject face ONCE per entry
				* and SPREADS it into props — a face getter is read exactly once and
				* frozen, which is why face-carried documents/activePath went stale. The
				* hooks channel survives: `bindInjectSources` converts each hooks member
				* into a `use<Name>` selector hook, and the hook reads the CURRENT
				* snapshot on every render (the same mechanism commandcode's usage store
				* rides).
				*
				* STABILITY CONTRACT: useSyncExternalStore requires getSnapshot() to
				* return the SAME reference between changes — a fresh object per call
				* re-renders forever and React kills the entry (error #185, the same
				* class of crash the settings card's unstable projection caused). So the
				* snapshot is a CACHED object, replaced wholesale by publish(); every
				* mutator builds the next snapshot and publishes exactly once.
				*/
				let dashboardSnap = {
					documents: [void 0, void 0],
					fetchedAt: void 0,
					loading: false,
					activePath: QODER_STATUS_PATH
				};
				const rebuildSnapshot = () => {
					const next = {
						documents: [dashboardDocuments.cn, dashboardDocuments.global],
						fetchedAt: dashboardFetchedAt,
						loading: dashboardLoading,
						activePath: dashboardRequestedPath
					};
					if (JSON.stringify(next) !== JSON.stringify(dashboardSnap)) {
						dashboardSnap = next;
						for (const listener of dashboardListeners) listener();
					}
				};
				const dashboardSource = {
					getSnapshot: () => dashboardSnap,
					subscribe: (listener) => {
						dashboardListeners.add(listener);
						return () => {
							dashboardListeners.delete(listener);
						};
					}
				};
				const notifyDashboard = () => {
					rebuildSnapshot();
				};
				/**
				* Refresh ONE variant's document (the one the panel is showing) — not
				* both. The earlier version fetched both routes on every panel mount, so
				* clicking the CN card also refreshed the Global card's data and timestamp;
				* the user ruled each click refreshes only what it shows.
				*
				* Freshness rule (also the user's): if the shared document for THIS
				* variant is newer than the configured interval, the fetch is SKIPPED —
				* a click shows the cached numbers instead of re-billing upstream. A
				* variant with NO result yet always fetches. A manual Refresh click
				* (force=true) bypasses the freshness check: an explicit user action
				* always re-reads.
				*/
				const refreshDashboard = async (options = {}) => {
					if (dashboardLoading) return;
					const variantId = variantOfStatusPath(dashboardRequestedPath);
					if (options.force !== true && quotaStatusIsFresh(variantId, quotaPollMs())) return;
					dashboardLoading = true;
					rebuildSnapshot();
					try {
						const result = await fetchStatusDocument(variantId === "qoder" ? QODER_STATUS_PATH : QODER_GLOBAL_STATUS_PATH);
						if (result !== void 0) noteQuotaStatus(variantId, result);
						dashboardFetchedAt = Date.now();
					} finally {
						dashboardLoading = false;
						rebuildSnapshot();
					}
				};
				let dashboardTimer;
				const startDashboardPoll = () => {
					if (dashboardTimer !== void 0) return;
					refreshDashboard();
					dashboardTimer = window.setInterval(() => {
						if (document.hidden) return;
						refreshDashboard();
					}, Math.max(6e4, quotaPollMs()));
				};
				const stopDashboardPoll = () => {
					if (dashboardTimer === void 0) return;
					window.clearInterval(dashboardTimer);
					dashboardTimer = void 0;
				};
				async function fetchStatusDocument(path) {
					try {
						const response = await fetch(path, { headers: { accept: "application/json" } });
						const body = await response.json();
						return response.ok && isQoderWebStatus(body) ? body : void 0;
					} catch {
						return;
					}
				}
				function QuotaDashboardWithLifecycle(props) {
					(0, react.useEffect)(() => {
						quotaPanelOpen = true;
						startDashboardPoll();
						return () => {
							quotaPanelOpen = false;
							stopDashboardPoll();
						};
					}, []);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaDashboard, { ...props });
				}
				const panelFace = () => ({
					hooks: { quotaDashboard: dashboardSource },
					t,
					statusPaths: [QODER_STATUS_PATH, QODER_GLOBAL_STATUS_PATH],
					refresh: () => {
						refreshDashboard({ force: true });
					},
					onVariantPicked: (path) => {
						dashboardRequestedPath = path;
						notifyDashboard();
						refreshDashboard();
					},
					close: () => {
						const layout = ctx.get("layout");
						if (typeof layout?.selectPanel !== "function") return;
						try {
							layout.selectPanel(null);
						} catch {
							try {
								layout.selectPanel(CONVERSATION_PANEL_ID);
							} catch (error) {
								console.error("[dsh-connect-qoder-x] could not close the quota panel:", error);
							}
						}
					}
				});
				ctx.effect(() => injectQuotaCss(), "dsh-connect-qoder-x: quota styles");
				try {
					ctx.slots.inject("main", () => ctx.slots.register({
						name: "main",
						key: QUOTA_PANEL_ID,
						locale: "panel.qoder-quota",
						inject: panelFace
					}, QuotaDashboardWithLifecycle));
				} catch (error) {
					console.error("[dsh-connect-qoder-x] could not register the quota dashboard:", error);
				}
				ctx.inject(["layout"], (layoutCtx) => {
					if (typeof layoutCtx.get("layout")?.selectPanel !== "function") return;
					try {
						for (const variant of QODER_CARD_VARIANTS) {
							const statusPath = VARIANT_STATUS[variant.id];
							if (statusPath === void 0) continue;
							const injected = {
								t,
								statusPath,
								open: () => {
									const current = layoutCtx.get("layout");
									if (typeof current?.selectPanel !== "function") return;
									if (quotaPanelOpen && dashboardRequestedPath === statusPath) {
										current.selectPanel(null);
										return;
									}
									dashboardRequestedPath = statusPath;
									notifyDashboard();
									refreshDashboard();
									current.selectPanel(QUOTA_PANEL_ID);
								}
							};
							layoutCtx.slots.inject("sidebar.footer.action", () => layoutCtx.slots.register({
								name: "sidebar.footer.action",
								id: variant.id === "qoder" ? "qoder-quota" : "qoder-global-quota",
								order: variant.id === "qoder" ? 20 : 21,
								locale: "panel.qoder-quota",
								inject: () => injected
							}, SidebarQuotaCard));
						}
					} catch (error) {
						console.error("[dsh-connect-qoder-x] could not register the sidebar footer card:", error);
					}
				});
				ctx.inject(["modelDirectories"], (scope) => {
					scope.slots.inject("conversation.input.right", () => scope.slots.register({
						name: "conversation.input.right",
						id: "qoder-probe",
						order: 10,
						inject: (sessionId) => ({
							directory: scope.modelDirectories.directoryFor(sessionId).store,
							t
						})
					}, QoderProbeControl));
				});
			} catch (error) {
				console.error("[dsh-connect-qoder-x] client card failed to load (host provider unaffected):", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
