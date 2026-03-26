/**
 * 支付页面 JavaScript
 * 支付页面：半自动 + 第三方自动绑卡 + 全自动绑卡任务管理 + 用户完成后自动验订阅
 */

const COUNTRY_CURRENCY_MAP = {
	US: "USD",
	GB: "GBP",
	CA: "CAD",
	AU: "AUD",
	SG: "SGD",
	HK: "HKD",
	JP: "JPY",
	TR: "TRY",
	IN: "INR",
	BR: "BRL",
	MX: "MXN",
	DE: "EUR",
	FR: "EUR",
	IT: "EUR",
	ES: "EUR",
	EU: "EUR",
};

const BILLING_STORAGE_KEY = "payment.billing_profile_non_sensitive";
const BILLING_TEMPLATE_STORAGE_KEY = "payment.billing_templates_v1";
const THIRD_PARTY_BIND_URL_STORAGE_KEY = "payment.third_party_bind_api_url";
const BIND_MODE_STORAGE_KEY = "payment.bind_mode";
const THIRD_PARTY_BIND_DEFAULT_URL =
	"https://twilight-river-f148.482091502.workers.dev/";
const BILLING_TEMPLATE_MAX = 200;
const BILLING_COUNTRY_CURRENCY_MAP = {
	US: "USD",
	GB: "GBP",
	CA: "CAD",
	AU: "AUD",
	SG: "SGD",
	HK: "HKD",
	JP: "JPY",
	DE: "EUR",
	FR: "EUR",
	IT: "EUR",
	ES: "EUR",
};

const COUNTRY_ALIAS_MAP = {
	us: { code: "US", currency: "USD" },
	usa: { code: "US", currency: "USD" },
	"united states": { code: "US", currency: "USD" },
	"hoa kỳ": { code: "US", currency: "USD" },
	mỹ: { code: "US", currency: "USD" },
	美国: { code: "US", currency: "USD" },
	uk: { code: "GB", currency: "GBP" },
	gb: { code: "GB", currency: "GBP" },
	england: { code: "GB", currency: "GBP" },
	"united kingdom": { code: "GB", currency: "GBP" },
	anh: { code: "GB", currency: "GBP" },
	"vương quốc anh": { code: "GB", currency: "GBP" },
	英国: { code: "GB", currency: "GBP" },
	ca: { code: "CA", currency: "CAD" },
	canada: { code: "CA", currency: "CAD" },
	"ca-na-da": { code: "CA", currency: "CAD" },
	加拿大: { code: "CA", currency: "CAD" },
	au: { code: "AU", currency: "AUD" },
	australia: { code: "AU", currency: "AUD" },
	úc: { code: "AU", currency: "AUD" },
	"ú c": { code: "AU", currency: "AUD" },
	"ô-xtrây-li-a": { code: "AU", currency: "AUD" },
	澳大利亚: { code: "AU", currency: "AUD" },
	sg: { code: "SG", currency: "SGD" },
	singapore: { code: "SG", currency: "SGD" },
	singapo: { code: "SG", currency: "SGD" },
	新加坡: { code: "SG", currency: "SGD" },
	hk: { code: "HK", currency: "HKD" },
	"hong kong": { code: "HK", currency: "HKD" },
	"hồng kông": { code: "HK", currency: "HKD" },
	香港: { code: "HK", currency: "HKD" },
	jp: { code: "JP", currency: "JPY" },
	japan: { code: "JP", currency: "JPY" },
	"nhật bản": { code: "JP", currency: "JPY" },
	日本: { code: "JP", currency: "JPY" },
	de: { code: "DE", currency: "EUR" },
	germany: { code: "DE", currency: "EUR" },
	đức: { code: "DE", currency: "EUR" },
	德国: { code: "DE", currency: "EUR" },
	fr: { code: "FR", currency: "EUR" },
	france: { code: "FR", currency: "EUR" },
	pháp: { code: "FR", currency: "EUR" },
	法国: { code: "FR", currency: "EUR" },
	it: { code: "IT", currency: "EUR" },
	italy: { code: "IT", currency: "EUR" },
	ý: { code: "IT", currency: "EUR" },
	意大利: { code: "IT", currency: "EUR" },
	es: { code: "ES", currency: "EUR" },
	spain: { code: "ES", currency: "EUR" },
	"tây ban nha": { code: "ES", currency: "EUR" },
	西班牙: { code: "ES", currency: "EUR" },
};

let selectedPlan = "plus";
let generatedLink = "";
let isGeneratingCheckoutLink = false;
let paymentAccounts = [];

const bindTaskState = {
	page: 1,
	pageSize: 50,
	status: "",
	search: "",
};
let bindTaskAutoRefreshTimer = null;

let billingBatchProfiles = [];

function formatErrorMessage(error) {
	if (!error) return "Lỗi không xác định";
	if (typeof error === "string") return error;

	// ApiClient 会把后端错误挂在 error.data 上
	const detail = error?.data?.detail ?? error?.message;
	if (typeof detail === "string" && detail && detail !== "[object Object]") {
		return detail;
	}
	try {
		return JSON.stringify(detail || error);
	} catch {
		return String(detail || error);
	}
}

function escapeHtml(value) {
	const div = document.createElement("div");
	div.textContent = String(value ?? "");
	return div.innerHTML;
}

function yesNo(value) {
	return value ? "Có" : "Không";
}

function showSessionDiagnosticPanel(text) {
	const panel = document.getElementById("session-diagnostic-panel");
	const pre = document.getElementById("session-diagnostic-text");
	if (!panel || !pre) return;
	pre.textContent = String(text || "");
	panel.classList.add("show");
}

function clearSessionDiagnosticPanel() {
	const panel = document.getElementById("session-diagnostic-panel");
	const pre = document.getElementById("session-diagnostic-text");
	if (!panel || !pre) return;
	pre.textContent = "";
	panel.classList.remove("show");
}

function formatSessionDiagnosticPayload(payload) {
	if (!payload || typeof payload !== "object") {
		return "Kết quả chẩn đoán trống";
	}
	const token = payload.token_state || {};
	const cookie = payload.cookie_state || {};
	const bootstrap = payload.bootstrap_capability || {};
	const probe = payload.probe || null;
	const notes = Array.isArray(payload.notes) ? payload.notes : [];

	const lines = [
		`Tài khoản: ${payload.email || "-"} (ID=${payload.account_id || "-"})`,
		`Mã truy cập: ${yesNo(token.has_access_token)} | len=${token.access_token_len || 0} | ${token.access_token_preview || "-"}`,
		`Mã làm mới: ${yesNo(token.has_refresh_token)} | len=${token.refresh_token_len || 0}`,
		`Session(DB): ${yesNo(token.has_session_token_db)} | len=${token.session_token_db_len || 0} | ${token.session_token_db_preview || "-"}`,
		`Session(Cookie): ${yesNo(token.has_session_token_cookie)} | len=${token.session_token_cookie_len || 0} | ${token.session_token_cookie_preview || "-"}`,
		`Session(Resolved): len=${token.resolved_session_token_len || 0} | ${token.resolved_session_token_preview || "-"}`,
		`Cookies: ${yesNo(cookie.has_cookies)} | len=${cookie.cookies_len || 0}`,
		`oai-did: ${yesNo(cookie.has_oai_did)} | ${cookie.resolved_oai_did || "-"}`,
		`Phân mảnh Session: count=${cookie.session_chunk_count || 0} | [${(cookie.session_chunk_indices || []).join(", ")}]`,
		`Khả năng tự bổ sung session: ${yesNo(bootstrap.can_login_bootstrap)} | has_password=${yesNo(bootstrap.has_password)} | email_service=${bootstrap.email_service_type || "-"}`,
	];

	if (probe) {
		lines.push(
			`Kiểm tra thời gian thực: ok=${yesNo(probe.ok)} | http=${probe.http_status ?? "-"} | session=${yesNo(probe.session_token_found)} | session_json_access=${yesNo(probe.access_token_in_session_json)}`,
		);
		if (probe.session_token_preview) {
			lines.push(
				`Xem trước session khi kiểm tra: ${probe.session_token_preview}`,
			);
		}
		if (probe.access_token_preview) {
			lines.push(
				`Xem trước access khi kiểm tra: ${probe.access_token_preview}`,
			);
		}
		if (probe.error) {
			lines.push(`Lỗi khi kiểm tra: ${probe.error}`);
		}
	}

	if (notes.length) {
		lines.push("Ghi chú chẩn đoán:");
		notes.forEach((n) => lines.push(`- ${n}`));
	}
	if (payload.recommendation) {
		lines.push(`Đề xuất: ${payload.recommendation}`);
	}
	if (payload.checked_at) {
		lines.push(`Thời gian kiểm tra: ${payload.checked_at}`);
	}
	return lines.join("\n");
}

async function runSessionDiagnostic() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	if (!accountId) {
		toast.warning("Vui lòng chọn tài khoản trước");
		return;
	}
	setButtonLoading("session-diagnostic-btn", "Đang chẩn đoán...", true);
	showSessionDiagnosticPanel(
		"Đang chẩn đoán ngữ cảnh session, vui lòng chờ...",
	);
	try {
		const data = await api.get(
			`/payment/accounts/${accountId}/session-diagnostic?probe=1`,
		);
		const diag = data?.diagnostic || {};
		showSessionDiagnosticPanel(formatSessionDiagnosticPayload(diag));
		toast.success("Đã chẩn đoán session xong");
	} catch (error) {
		const message = formatErrorMessage(error);
		showSessionDiagnosticPanel(`Chẩn đoán session thất bại: ${message}`);
		toast.error(`Chẩn đoán session thất bại: ${message}`);
	} finally {
		setButtonLoading("session-diagnostic-btn", "Đang chẩn đoán...", false);
	}
}

async function runSessionBootstrap() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	if (!accountId) {
		toast.warning("Vui lòng chọn tài khoản trước");
		return;
	}
	setButtonLoading("session-bootstrap-btn", "Đang bổ sung...", true);
	showSessionDiagnosticPanel(
		"Đang thực hiện bổ sung session, vui lòng chờ (có thể cần đợi mã xác minh email)...",
	);
	try {
		const data = await api.post(
			`/payment/accounts/${accountId}/session-bootstrap`,
			{},
		);
		if (data?.success) {
			toast.success(
				`Bổ sung session thành công (len=${data?.session_token_len || 0})`,
			);
		} else {
			toast.warning(
				data?.message || "Chưa tìm thấy dữ liệu để bổ sung session",
			);
		}
		await runSessionDiagnostic();
	} catch (error) {
		const message = formatErrorMessage(error);
		showSessionDiagnosticPanel(`Bổ sung session thất bại: ${message}`);
		toast.error(`Bổ sung session thất bại: ${message}`);
	} finally {
		setButtonLoading("session-bootstrap-btn", "Đang bổ sung...", false);
	}
}

async function saveManualSessionToken() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	if (!accountId) {
		toast.warning("Vui lòng chọn tài khoản trước");
		return;
	}
	const sessionToken = String(
		document.getElementById("manual-session-token-input")?.value || "",
	).trim();
	if (!sessionToken) {
		toast.warning("Vui lòng dán session_token trước");
		return;
	}

	setButtonLoading("save-session-token-btn", "Đang lưu...", true);
	try {
		const data = await api.post(
			`/payment/accounts/${accountId}/session-token`,
			{
				session_token: sessionToken,
				merge_cookie: true,
			},
		);
		if (data?.success) {
			toast.success(`Đã lưu mã phiên (len=${data?.session_token_len || 0})`);
			await runSessionDiagnostic();
			return;
		}
		toast.warning(
			data?.message || "Đã lưu xong nhưng phản hồi không trả về success",
		);
	} catch (error) {
		toast.error(`Lưu mã phiên thất bại: ${formatErrorMessage(error)}`);
	} finally {
		setButtonLoading("save-session-token-btn", "Đang lưu...", false);
	}
}

function getInputValue(id) {
	return (document.getElementById(id)?.value || "").trim();
}

function setInputValue(id, value) {
	const el = document.getElementById(id);
	if (!el) return;
	el.value = value ?? "";
}

function maskCardNumber(cardNumber) {
	const digits = String(cardNumber || "").replace(/\D/g, "");
	if (!digits) return "-";
	if (digits.length <= 8) return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
	return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

function resolveCountryAlias(raw) {
	const key = String(raw || "").trim();
	if (!key) return null;
	const normalized = key.toLowerCase();
	if (COUNTRY_ALIAS_MAP[normalized]) {
		return COUNTRY_ALIAS_MAP[normalized];
	}
	const upper = key.toUpperCase();
	if (BILLING_COUNTRY_CURRENCY_MAP[upper]) {
		return {
			code: upper,
			currency: BILLING_COUNTRY_CURRENCY_MAP[upper],
		};
	}
	return null;
}

function normalizeMonth(value) {
	const digits = String(value || "").replace(/\D/g, "");
	if (!digits) return "";
	return digits.slice(0, 2).padStart(2, "0");
}

function normalizeYear(value) {
	const digits = String(value || "").replace(/\D/g, "");
	if (!digits) return "";
	if (digits.length === 2) return `20${digits}`;
	return digits.slice(0, 4);
}

function formatExpiryInput(month, year) {
	const mm = normalizeMonth(month);
	const rawYear = String(year || "").replace(/\D/g, "");
	const yy = rawYear ? rawYear.slice(-2) : "";
	if (!mm && !yy) return "";
	return yy ? `${mm}/${yy}` : mm;
}

function parseExpiryInput(value) {
	const raw = String(value || "").trim();
	if (!raw) {
		return { exp_month: "", exp_year: "" };
	}

	const slashMatch = raw.match(/^(\d{1,2})\s*\/\s*(\d{1,4})$/);
	if (slashMatch) {
		return {
			exp_month: normalizeMonth(slashMatch[1]),
			exp_year: normalizeYear(slashMatch[2]),
		};
	}

	const digits = raw.replace(/\D/g, "");
	if (!digits) {
		return { exp_month: "", exp_year: "" };
	}
	if (digits.length <= 2) {
		return { exp_month: normalizeMonth(digits), exp_year: "" };
	}
	return {
		exp_month: normalizeMonth(digits.slice(0, 2)),
		exp_year: normalizeYear(digits.slice(2)),
	};
}

function normalizeExpiryInputForTyping(value) {
	const digits = String(value || "")
		.replace(/\D/g, "")
		.slice(0, 6);
	if (!digits) return "";
	if (digits.length <= 2) return digits;
	return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function parseCardText(rawText) {
	const text = String(rawText || "").trim();
	if (!text) return {};

	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const kv = {};
	for (const line of lines) {
		const match = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
		if (match) {
			kv[match[1].trim().toLowerCase()] = match[2].trim();
		}
	}

	const result = {};

	// 卡号
	const cardKeyCandidates = [
		"卡号",
		"số thẻ",
		"so the",
		"card number",
		"card",
		"card_number",
	];
	for (const key of cardKeyCandidates) {
		if (!kv[key]) continue;
		const digits = kv[key].replace(/\D/g, "");
		if (digits.length >= 13 && digits.length <= 19) {
			result.card_number = digits;
			break;
		}
	}

	if (!result.card_number) {
		for (const line of lines) {
			const m = line
				.replace(/-/g, " ")
				.match(/^(\d{13,19})\s+(0[1-9]|1[0-2])\s+(\d{2,4})\s+(\d{3,4})$/);
			if (m) {
				result.card_number = m[1];
				result.exp_month = normalizeMonth(m[2]);
				result.exp_year = normalizeYear(m[3]);
				result.cvv = m[4];
				break;
			}
		}
	}

	if (!result.card_number) {
		for (const line of lines) {
			const digits = line.replace(/\D/g, "");
			if (digits.length >= 13 && digits.length <= 19) {
				result.card_number = digits;
				break;
			}
		}
	}

	// 有效期
	const expiryKeyCandidates = [
		"有效期",
		"hạn dùng",
		"han dung",
		"hết hạn",
		"het han",
		"exp",
		"expiry",
		"expiration",
		"exp_date",
	];
	for (const key of expiryKeyCandidates) {
		if (!kv[key]) continue;
		const value = kv[key];
		let m = value.match(/(0[1-9]|1[0-2])\s*\/\s*(\d{2,4})/);
		if (m) {
			result.exp_month = normalizeMonth(m[1]);
			result.exp_year = normalizeYear(m[2]);
			break;
		}
		m = value.match(/^(0[1-9]|1[0-2])(\d{2,4})$/);
		if (m) {
			result.exp_month = normalizeMonth(m[1]);
			result.exp_year = normalizeYear(m[2]);
			break;
		}
	}
	if (!result.exp_month || !result.exp_year) {
		for (const line of lines) {
			const m = line.match(/\b(0[1-9]|1[0-2])\s*\/\s*(\d{2,4})\b/);
			if (m) {
				result.exp_month = normalizeMonth(m[1]);
				result.exp_year = normalizeYear(m[2]);
				break;
			}
		}
	}

	// CVV
	const cvvKeyCandidates = ["cvv", "cvc", "mã bảo mật", "ma bao mat", "安全码"];
	for (const key of cvvKeyCandidates) {
		if (!kv[key]) continue;
		const m = kv[key].match(/\b(\d{3,4})\b/);
		if (m) {
			result.cvv = m[1];
			break;
		}
	}
	if (!result.cvv) {
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			if (!/(cvv|cvc|mã bảo mật|ma bao mat|安全码)/i.test(line)) continue;
			const direct = line.match(/\b(\d{3,4})\b/);
			if (direct) {
				result.cvv = direct[1];
				break;
			}
			const next = lines[i + 1] || "";
			const m = next.match(/\b(\d{3,4})\b/);
			if (m) {
				result.cvv = m[1];
				break;
			}
		}
	}

	// 姓名
	const nameKeyCandidates = [
		"姓名",
		"họ tên",
		"ho ten",
		"tên chủ thẻ",
		"ten chu the",
		"name",
		"cardholder",
		"持卡人",
	];
	for (const key of nameKeyCandidates) {
		if (kv[key]) {
			result.billing_name = kv[key];
			break;
		}
	}
	if (!result.billing_name) {
		for (const line of lines) {
			if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){0,4}$/.test(line)) {
				result.billing_name = line;
				break;
			}
		}
	}

	// 地址字段
	const addressLine =
		kv["地址"] ||
		kv["địa chỉ"] ||
		kv["dia chi"] ||
		kv["address"] ||
		kv["address_line1"] ||
		"";
	const city =
		kv["城市"] || kv["thành phố"] || kv["thanh pho"] || kv["city"] || "";
	const state =
		kv["州"] ||
		kv["省"] ||
		kv["bang/tinh"] ||
		kv["bang"] ||
		kv["tỉnh"] ||
		kv["tinh"] ||
		kv["state"] ||
		"";
	const postal =
		kv["邮编"] ||
		kv["mã bưu chính"] ||
		kv["ma buu chinh"] ||
		kv["mã zip"] ||
		kv["ma zip"] ||
		kv["postal_code"] ||
		kv["zip"] ||
		kv["zipcode"] ||
		kv["zip_code"] ||
		"";
	const countryRaw =
		kv["国家"] ||
		kv["quốc gia"] ||
		kv["quoc gia"] ||
		kv["country"] ||
		kv["地区"] ||
		"";

	if (addressLine) result.address_line1 = addressLine;
	if (city) result.address_city = city;
	if (state) result.address_state = state;
	if (postal) result.postal_code = postal;

	if (countryRaw) {
		const country = resolveCountryAlias(countryRaw);
		if (country) {
			result.country_code = country.code;
			result.currency = country.currency;
		}
	}

	// 账单地址单行模式
	if (!result.address_line1) {
		let addressCandidate = "";
		for (const line of lines) {
			if (
				/(账单地址|địa chỉ thanh toán|dia chi thanh toan|billing\s*address)/i.test(
					line,
				)
			) {
				addressCandidate = line
					.replace(
						/^.*?(账单地址|địa chỉ thanh toán|dia chi thanh toan|billing\s*address)\s*[:：]?\s*/i,
						"",
					)
					.trim();
				if (addressCandidate) break;
			}
		}
		if (!addressCandidate) {
			addressCandidate =
				lines.find((line) => line.includes(",") && /\d/.test(line)) || "";
		}
		if (addressCandidate) {
			result.raw_address = addressCandidate;
			const parts = addressCandidate
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean);
			if (parts.length) {
				result.address_line1 = parts[0];
			}
			if (!result.postal_code) {
				const zip = addressCandidate.match(/\b(\d{5}(?:-\d{4})?)\b/);
				if (zip) result.postal_code = zip[1];
			}
			if (!result.address_state) {
				const stateCode = addressCandidate.match(/\b([A-Z]{2})\b/);
				if (stateCode) result.address_state = stateCode[1];
			}
			const suffix = parts[parts.length - 1];
			if (!result.country_code && suffix) {
				const country = resolveCountryAlias(suffix);
				if (country) {
					result.country_code = country.code;
					result.currency = country.currency;
				}
			}
		}
	}

	return result;
}

function buildParsedSummary(parsed) {
	const parts = [];
	if (parsed.card_number)
		parts.push(`Số thẻ: ${maskCardNumber(parsed.card_number)}`);
	if (parsed.exp_month || parsed.exp_year) {
		parts.push(
			`Hạn dùng: ${formatExpiryInput(parsed.exp_month, parsed.exp_year) || "--/--"}`,
		);
	}
	if (parsed.cvv) parts.push("CVV: ***");
	if (parsed.billing_name) parts.push(`Họ tên: ${parsed.billing_name}`);
	if (parsed.address_line1 || parsed.raw_address) {
		parts.push(`Địa chỉ: ${parsed.raw_address || parsed.address_line1}`);
	}
	if (parsed.country_code) parts.push(`Quốc gia: ${parsed.country_code}`);
	return parts;
}

function fillBillingForm(parsed) {
	if (!parsed || typeof parsed !== "object") return;

	if (parsed.card_number)
		setInputValue("card-number-input", parsed.card_number);
	if (parsed.exp_month || parsed.exp_year) {
		setInputValue(
			"card-expiry-input",
			formatExpiryInput(parsed.exp_month, parsed.exp_year),
		);
	}
	if (parsed.cvc || parsed.cvv)
		setInputValue("card-cvc-input", String(parsed.cvc || parsed.cvv || ""));
	if (parsed.billing_name)
		setInputValue("billing-name-input", parsed.billing_name);
	if (parsed.address_line1)
		setInputValue("billing-line1-input", parsed.address_line1);
	if (parsed.address_city)
		setInputValue("billing-city-input", parsed.address_city);
	if (parsed.address_state)
		setInputValue("billing-state-input", parsed.address_state);
	if (parsed.postal_code)
		setInputValue("billing-postal-input", parsed.postal_code);

	if (parsed.country_code) {
		const countryEl = document.getElementById("billing-country-input");
		if (countryEl) countryEl.value = parsed.country_code;
	}

	if (parsed.currency) {
		setInputValue("billing-currency-input", parsed.currency);
	} else {
		onBillingCountryChanged();
	}

	persistBillingProfileNonSensitive();
}

function onBillingCountryChanged() {
	const country = (
		document.getElementById("billing-country-input")?.value || "US"
	).toUpperCase();
	const currencyEl = document.getElementById("billing-currency-input");
	if (!currencyEl) return;
	if (
		!currencyEl.value ||
		currencyEl.value === "USD" ||
		currencyEl.value.length < 3
	) {
		currencyEl.value = BILLING_COUNTRY_CURRENCY_MAP[country] || "USD";
	}
}

function setRandomBillingHint(message, mode = "info") {
	const hintEl = document.getElementById("random-billing-hint");
	if (!hintEl) return;
	hintEl.textContent = String(message || "");
	if (mode === "success") {
		hintEl.style.color = "var(--success-color)";
		return;
	}
	if (mode === "error") {
		hintEl.style.color = "var(--danger-color)";
		return;
	}
	hintEl.style.color = "var(--text-secondary)";
}

async function randomBillingByCountry() {
	const country = String(
		getInputValue("billing-country-input") || "US",
	).toUpperCase();
	setButtonLoading("random-billing-btn", "Đang tạo...", true);
	setRandomBillingHint("Đang lấy thông tin thanh toán ngẫu nhiên...", "info");
	try {
		const data = await api.get(
			`/payment/random-billing?country=${encodeURIComponent(country)}`,
		);
		const profile = data?.profile || {};
		if (!profile || typeof profile !== "object") {
			throw new Error("Dữ liệu thanh toán trả về không hợp lệ");
		}

		fillBillingForm({
			billing_name: profile.billing_name || "",
			country_code: profile.country_code || country,
			currency: profile.currency || "",
			address_line1: profile.address_line1 || "",
			address_city: profile.address_city || "",
			address_state: profile.address_state || "",
			postal_code: profile.postal_code || "",
		});

		const source = String(profile.source || "unknown");
		let sourceLabel = "Dữ liệu dự phòng cục bộ";
		if (source === "meiguodizhi") sourceLabel = "Dịch vụ địa chỉ bên ngoài";
		if (source === "local_geo") sourceLabel = "Dữ liệu tạo cục bộ";
		if (source === "local_geo_fallback")
			sourceLabel = "Dữ liệu dự phòng cục bộ";
		const fallbackReason = String(profile.fallback_reason || "").trim();
		const city = String(profile.address_city || "-");
		const state = String(profile.address_state || "-");
		const postal = String(profile.postal_code || "-");
		if (
			(source === "local_fallback" || source === "local_geo_fallback") &&
			fallbackReason
		) {
			setRandomBillingHint(
				`Nguồn: ${sourceLabel} | ${city}, ${state}, ${postal} | Nguồn ngoài lỗi: ${fallbackReason}`,
				"error",
			);
			toast.warning(
				`Nguồn địa chỉ bên ngoài không khả dụng, đã chuyển sang dữ liệu dự phòng cục bộ: ${fallbackReason}`,
			);
		} else {
			setRandomBillingHint(
				`Nguồn: ${sourceLabel} | ${city}, ${state}, ${postal}`,
				"success",
			);
			toast.success(
				`Đã điền ngẫu nhiên thông tin thanh toán theo ${country} (${sourceLabel})`,
			);
		}
	} catch (error) {
		setRandomBillingHint(
			`Tạo ngẫu nhiên thất bại: ${formatErrorMessage(error)}`,
			"error",
		);
		toast.error(
			`Lấy thông tin thanh toán ngẫu nhiên thất bại: ${formatErrorMessage(error)}`,
		);
	} finally {
		setButtonLoading("random-billing-btn", "Đang tạo...", false);
	}
}

function collectBillingFormData() {
	const expiry = parseExpiryInput(getInputValue("card-expiry-input"));
	return {
		card_number: getInputValue("card-number-input").replace(/\D/g, ""),
		exp_month: expiry.exp_month,
		exp_year: expiry.exp_year,
		cvc: getInputValue("card-cvc-input").replace(/\D/g, ""),
		billing_name: getInputValue("billing-name-input"),
		country_code: getInputValue("billing-country-input").toUpperCase(),
		currency: getInputValue("billing-currency-input").toUpperCase(),
		address_line1: getInputValue("billing-line1-input"),
		address_city: getInputValue("billing-city-input"),
		address_state: getInputValue("billing-state-input"),
		postal_code: getInputValue("billing-postal-input"),
	};
}

function persistBillingProfileNonSensitive() {
	const data = collectBillingFormData();
	storage.set(BILLING_STORAGE_KEY, {
		billing_name: data.billing_name,
		country_code: data.country_code,
		currency: data.currency,
		address_line1: data.address_line1,
		address_city: data.address_city,
		address_state: data.address_state,
		postal_code: data.postal_code,
	});
}

function restoreBillingProfileNonSensitive() {
	const saved = storage.get(BILLING_STORAGE_KEY, null);
	if (!saved || typeof saved !== "object") {
		setInputValue("billing-country-input", "US");
		setInputValue("billing-currency-input", "USD");
		return;
	}
	if (saved.billing_name)
		setInputValue("billing-name-input", saved.billing_name);
	if (saved.country_code)
		setInputValue("billing-country-input", saved.country_code);
	if (saved.currency) setInputValue("billing-currency-input", saved.currency);
	if (saved.address_line1)
		setInputValue("billing-line1-input", saved.address_line1);
	if (saved.address_city)
		setInputValue("billing-city-input", saved.address_city);
	if (saved.address_state)
		setInputValue("billing-state-input", saved.address_state);
	if (saved.postal_code)
		setInputValue("billing-postal-input", saved.postal_code);
	onBillingCountryChanged();
}

function getBillingTemplates() {
	const raw = storage.get(BILLING_TEMPLATE_STORAGE_KEY, []);
	if (!Array.isArray(raw)) return [];
	return raw
		.filter(
			(item) =>
				item && typeof item === "object" && item.id && item.name && item.data,
		)
		.slice(0, BILLING_TEMPLATE_MAX);
}

function saveBillingTemplates(list) {
	const safeList = Array.isArray(list)
		? list.slice(0, BILLING_TEMPLATE_MAX)
		: [];
	storage.set(BILLING_TEMPLATE_STORAGE_KEY, safeList);
}

function normalizeTemplateData(data) {
	const source = data && typeof data === "object" ? data : {};
	return {
		card_number: String(source.card_number || "").replace(/\D/g, ""),
		exp_month: normalizeMonth(source.exp_month),
		exp_year: normalizeYear(source.exp_year),
		cvc: String(source.cvc || source.cvv || "")
			.replace(/\D/g, "")
			.slice(0, 4),
		billing_name: String(source.billing_name || "").trim(),
		country_code:
			String(source.country_code || "US")
				.trim()
				.toUpperCase() || "US",
		currency: String(source.currency || "")
			.trim()
			.toUpperCase(),
		address_line1: String(source.address_line1 || "").trim(),
		address_city: String(source.address_city || "").trim(),
		address_state: String(source.address_state || "").trim(),
		postal_code: String(source.postal_code || "").trim(),
	};
}

function refreshBillingTemplateSelect(selectedId = "") {
	const selectEl = document.getElementById("billing-template-select");
	if (!selectEl) return;
	const templates = getBillingTemplates();

	const options = ['<option value="">-- Chọn mẫu đã lưu --</option>'];
	templates.forEach((tpl) => {
		options.push(
			`<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name)}</option>`,
		);
	});
	selectEl.innerHTML = options.join("");

	if (selectedId && templates.some((tpl) => tpl.id === selectedId)) {
		selectEl.value = selectedId;
	}
}

function saveCurrentAsTemplate() {
	const name = getInputValue("billing-template-name");
	if (!name) {
		toast.warning("Vui lòng nhập tên mẫu trước");
		return;
	}

	const form = normalizeTemplateData(collectBillingFormData());
	const hasValue = Boolean(
		form.card_number ||
			(form.exp_month && form.exp_year) ||
			form.cvc ||
			form.billing_name ||
			form.address_line1,
	);
	if (!hasValue) {
		toast.warning("Biểu mẫu hiện đang trống, không thể lưu mẫu");
		return;
	}

	const templates = getBillingTemplates();
	const normalizedName = name.toLowerCase();
	const existing = templates.find(
		(tpl) => String(tpl.name || "").toLowerCase() === normalizedName,
	);
	const nowIso = new Date().toISOString();
	if (existing) {
		existing.data = form;
		existing.updated_at = nowIso;
		saveBillingTemplates(templates);
		refreshBillingTemplateSelect(existing.id);
		toast.success(`Đã cập nhật mẫu: ${name}`);
		return;
	}

	const newTemplate = {
		id: `tpl_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
		name,
		data: form,
		created_at: nowIso,
		updated_at: nowIso,
	};
	templates.unshift(newTemplate);
	saveBillingTemplates(templates);
	refreshBillingTemplateSelect(newTemplate.id);
	toast.success(`Đã lưu mẫu: ${name}`);
}

function applySelectedTemplate() {
	const selectEl = document.getElementById("billing-template-select");
	if (!selectEl || !selectEl.value) {
		toast.warning("Vui lòng chọn mẫu trước");
		return;
	}
	const templates = getBillingTemplates();
	const selected = templates.find((tpl) => tpl.id === selectEl.value);
	if (!selected) {
		toast.warning("Mẫu không tồn tại hoặc đã bị xóa");
		refreshBillingTemplateSelect();
		return;
	}
	fillBillingForm(selected.data || {});
	setInputValue("billing-template-name", selected.name || "");
	toast.success(`Đã áp dụng mẫu: ${selected.name}`);
}

async function deleteSelectedTemplate() {
	const selectEl = document.getElementById("billing-template-select");
	if (!selectEl || !selectEl.value) {
		toast.warning("Vui lòng chọn mẫu trước");
		return;
	}

	const templates = getBillingTemplates();
	const selected = templates.find((tpl) => tpl.id === selectEl.value);
	if (!selected) {
		toast.warning("Mẫu không tồn tại hoặc đã bị xóa");
		refreshBillingTemplateSelect();
		return;
	}

	const ok = await confirm(`Xác nhận xóa mẫu "${selected.name}"?`, "Xóa mẫu");
	if (!ok) return;

	const next = templates.filter((tpl) => tpl.id !== selected.id);
	saveBillingTemplates(next);
	refreshBillingTemplateSelect();
	setInputValue("billing-template-name", "");
	toast.success(`Đã xóa mẫu: ${selected.name}`);
}

function saveBatchProfilesAsTemplates() {
	if (!billingBatchProfiles.length) {
		toast.warning("Vui lòng nhận diện hàng loạt văn bản trước");
		return;
	}

	const templates = getBillingTemplates();
	const now = new Date();
	let saved = 0;

	billingBatchProfiles.forEach((item, idx) => {
		const parsed = item?.parsed || {};
		const data = normalizeTemplateData({
			card_number: parsed.card_number,
			exp_month: parsed.exp_month,
			exp_year: parsed.exp_year,
			cvc: parsed.cvv,
			billing_name: parsed.billing_name,
			country_code: parsed.country_code,
			currency: parsed.currency,
			address_line1: parsed.address_line1,
			address_city: parsed.address_city,
			address_state: parsed.address_state,
			postal_code: parsed.postal_code,
		});
		const hasValue = Boolean(
			data.card_number ||
				(data.exp_month && data.exp_year) ||
				data.cvc ||
				data.billing_name ||
				data.address_line1,
		);
		if (!hasValue) return;

		const suffix = data.card_number
			? data.card_number.slice(-4)
			: String(idx + 1).padStart(2, "0");
		const name = `Mẫu hàng loạt-${now.toISOString().slice(0, 10)}-${suffix}`;
		templates.unshift({
			id: `tpl_${Date.now()}_${Math.random().toString(16).slice(2, 8)}_${idx}`,
			name,
			data,
			created_at: now.toISOString(),
			updated_at: now.toISOString(),
		});
		saved += 1;
	});

	if (!saved) {
		toast.warning("Không có mẫu nào có thể lưu trong danh sách hàng loạt");
		return;
	}

	saveBillingTemplates(templates);
	refreshBillingTemplateSelect();
	toast.success(`Đã lưu ${saved} mẫu`);
}

function setParseResult(message, type = "info") {
	const resultEl = document.getElementById("billing-parse-result");
	if (!resultEl) return;
	resultEl.textContent = message || "";
	if (type === "error") {
		resultEl.style.color = "var(--danger-color)";
	} else if (type === "success") {
		resultEl.style.color = "var(--success-color)";
	} else {
		resultEl.style.color = "var(--text-secondary)";
	}
}

function parseSingleBillingText() {
	const text = getInputValue("billing-paste-text");
	if (!text) {
		setParseResult("Vui lòng dán văn bản trước", "error");
		return;
	}

	const parsed = parseCardText(text);
	const summary = buildParsedSummary(parsed);
	if (!summary.length) {
		setParseResult(
			"Không nhận diện được thông tin hợp lệ, vui lòng kiểm tra lại định dạng văn bản",
			"error",
		);
		return;
	}

	fillBillingForm(parsed);
	setParseResult(`Nhận diện thành công: ${summary.join(" | ")}`, "success");
}

function splitBatchBlocks(rawText) {
	const blocks = String(rawText || "")
		.split(/\n\s*\n+/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (blocks.length > 1) return blocks;
	return String(rawText || "")
		.split(/(?:^-{3,}|^={3,})/m)
		.map((part) => part.trim())
		.filter(Boolean);
}

function renderBatchProfiles() {
	const wrap = document.getElementById("billing-batch-wrap");
	const summary = document.getElementById("billing-batch-summary");
	const tbody = document.getElementById("billing-batch-table");
	if (!wrap || !summary || !tbody) return;

	if (!billingBatchProfiles.length) {
		wrap.style.display = "none";
		tbody.innerHTML = "";
		summary.textContent = "";
		return;
	}

	wrap.style.display = "";
	summary.textContent = `Đã nhận diện ${billingBatchProfiles.length} bản ghi, bấm “Điền vào biểu mẫu” để ghi vào biểu mẫu bên dưới.`;
	tbody.innerHTML = billingBatchProfiles
		.map((item, index) => {
			const parsed = item.parsed || {};
			const address =
				parsed.raw_address ||
				[
					parsed.address_line1,
					parsed.address_city,
					parsed.address_state,
					parsed.postal_code,
				]
					.filter(Boolean)
					.join(", ");
			return `
            <tr>
                <td>${index + 1}</td>
                <td class="bind-mask">${escapeHtml(maskCardNumber(parsed.card_number))}</td>
                <td>${escapeHtml(formatExpiryInput(parsed.exp_month, parsed.exp_year) || "-")}</td>
                <td>${escapeHtml(parsed.cvv ? "***" : "-")}</td>
                <td>${escapeHtml(parsed.country_code || "-")}</td>
                <td>${escapeHtml(address || "-")}</td>
				<td><button type="button" class="btn btn-secondary btn-sm" onclick="fillFromBatchProfile(${index})">Điền vào biểu mẫu</button></td>
            </tr>
        `;
		})
		.join("");
}

function parseBatchBillingText() {
	const text = getInputValue("billing-paste-text");
	if (!text) {
		setParseResult("Vui lòng dán văn bản trước", "error");
		return;
	}

	const blocks = splitBatchBlocks(text);
	if (!blocks.length) {
		setParseResult(
			"Không phát hiện được khối văn bản nào có thể phân tích",
			"error",
		);
		return;
	}

	billingBatchProfiles = blocks
		.map((blockText) => ({ raw: blockText, parsed: parseCardText(blockText) }))
		.filter((item) => {
			const parsed = item.parsed || {};
			return Boolean(
				parsed.card_number ||
					parsed.exp_month ||
					parsed.exp_year ||
					parsed.cvv ||
					parsed.address_line1 ||
					parsed.raw_address,
			);
		});

	renderBatchProfiles();
	if (!billingBatchProfiles.length) {
		setParseResult(
			"Đã nhận diện hàng loạt xong nhưng không có bản ghi khả dụng",
			"error",
		);
		return;
	}

	setParseResult(
		`Nhận diện hàng loạt thành công: tổng ${billingBatchProfiles.length} bản ghi`,
		"success",
	);
}

function fillFromBatchProfile(index) {
	const item = billingBatchProfiles[index];
	if (!item) return;
	fillBillingForm(item.parsed || {});
	const summary = buildParsedSummary(item.parsed || {});
	setParseResult(
		`Đã điền bản ghi số ${index + 1}: ${summary.join(" | ")}`,
		"success",
	);
}

function clearBillingText() {
	setInputValue("billing-paste-text", "");
	billingBatchProfiles = [];
	renderBatchProfiles();
	setParseResult("", "info");
}

function bindBillingEvents() {
	document
		.getElementById("parse-billing-btn")
		?.addEventListener("click", parseSingleBillingText);
	document
		.getElementById("parse-batch-btn")
		?.addEventListener("click", parseBatchBillingText);
	document
		.getElementById("clear-billing-btn")
		?.addEventListener("click", clearBillingText);
	document
		.getElementById("save-billing-template-btn")
		?.addEventListener("click", saveCurrentAsTemplate);
	document
		.getElementById("apply-billing-template-btn")
		?.addEventListener("click", applySelectedTemplate);
	document
		.getElementById("delete-billing-template-btn")
		?.addEventListener("click", deleteSelectedTemplate);
	document
		.getElementById("save-batch-template-btn")
		?.addEventListener("click", saveBatchProfilesAsTemplates);
	document
		.getElementById("billing-template-select")
		?.addEventListener("change", (event) => {
			const selectValue = event?.target?.value || "";
			if (!selectValue) {
				setInputValue("billing-template-name", "");
				return;
			}
			const selected = getBillingTemplates().find(
				(tpl) => tpl.id === selectValue,
			);
			if (selected) {
				setInputValue("billing-template-name", selected.name || "");
			}
		});

	document
		.getElementById("billing-country-input")
		?.addEventListener("change", () => {
			onBillingCountryChanged();
			persistBillingProfileNonSensitive();
			setRandomBillingHint("");
		});

	[
		"card-number-input",
		"card-expiry-input",
		"card-cvc-input",
		"billing-name-input",
		"billing-country-input",
		"billing-currency-input",
		"billing-line1-input",
		"billing-city-input",
		"billing-state-input",
		"billing-postal-input",
	].forEach((id) => {
		const node = document.getElementById(id);
		node?.addEventListener(
			"input",
			debounce(() => {
				persistBillingProfileNonSensitive();
				resetGenerateLinkButtonState();
			}, 200),
		);
		node?.addEventListener("change", resetGenerateLinkButtonState);
	});

	document
		.getElementById("card-expiry-input")
		?.addEventListener("input", (event) => {
			const el = event.target;
			if (!el) return;
			const next = normalizeExpiryInputForTyping(el.value);
			if (el.value !== next) {
				el.value = next;
			}
		});

	document
		.getElementById("card-number-input")
		?.addEventListener("input", (event) => {
			const el = event.target;
			if (!el) return;
			const digits = String(el.value || "")
				.replace(/\D/g, "")
				.slice(0, 19);
			const grouped = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
			if (el.value !== grouped) {
				el.value = grouped;
			}
		});

	document
		.getElementById("card-cvc-input")
		?.addEventListener("input", (event) => {
			const el = event.target;
			if (!el) return;
			const digits = String(el.value || "")
				.replace(/\D/g, "")
				.slice(0, 4);
			if (el.value !== digits) {
				el.value = digits;
			}
		});
}

function getTaskStatusText(status) {
	const mapping = {
		link_ready: "Chờ mở",
		opened: "Đã mở",
		waiting_user_action: "Chờ người dùng hoàn tất",
		paid_pending_sync: "Đã thanh toán, chờ đồng bộ",
		verifying: "Đang xác minh",
		completed: "Hoàn tất",
		failed: "Thất bại",
	};
	return mapping[status] || status || "-";
}

function startBindTaskAutoRefresh() {
	stopBindTaskAutoRefresh();
	bindTaskAutoRefreshTimer = setInterval(() => {
		const bindTaskTab = document.getElementById("tab-content-bind-task");
		if (!bindTaskTab?.classList.contains("active")) return;
		loadBindCardTasks(true);
	}, 20000);
}

function stopBindTaskAutoRefresh() {
	if (!bindTaskAutoRefreshTimer) return;
	clearInterval(bindTaskAutoRefreshTimer);
	bindTaskAutoRefreshTimer = null;
}

function setButtonLoading(buttonId, loadingText, isLoading) {
	const btn = document.getElementById(buttonId);
	if (!btn) return;
	if (isLoading) {
		if (!btn.dataset.originalText) {
			btn.dataset.originalText = btn.textContent || "";
		}
		btn.disabled = true;
		btn.textContent = loadingText;
		return;
	}
	btn.disabled = false;
	btn.textContent = btn.dataset.originalText || btn.textContent;
}

function resetGenerateLinkButtonState() {
	const btn = document.getElementById("generate-link-btn");
	if (!btn) return;
	btn.disabled = false;
	if (btn.dataset.originalText) {
		btn.textContent = btn.dataset.originalText;
	}
}

function getBindMode() {
	return (
		(
			document.getElementById("bind-mode-select")?.value || "semi_auto"
		).trim() || "semi_auto"
	);
}

function updateSemiAutoActionsVisibility(mode) {
	const isSemiAuto = (mode || getBindMode()) === "semi_auto";
	const loginBtn = document.getElementById("semi-login-gpt-btn");
	const emailBtn = document.getElementById("semi-account-email-btn");
	if (loginBtn) {
		loginBtn.style.display = isSemiAuto ? "" : "none";
	}
	if (emailBtn) {
		emailBtn.style.display = isSemiAuto ? "" : "none";
	}
}

function getSelectedAccountEmail() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	if (!accountId) return "";
	const matched = (paymentAccounts || []).find(
		(acc) => Number(acc?.id || 0) === accountId,
	);
	return String(matched?.email || "").trim();
}

function updateSelectedAccountEmailLabel() {
	const emailBtn = document.getElementById("semi-account-email-btn");
	if (!emailBtn) return;
	const email = getSelectedAccountEmail();
	emailBtn.textContent = "Email";
	emailBtn.title = email
		? `Tài khoản hiện tại: ${email} (bấm để kiểm tra mã xác minh mới nhất)`
		: "Vui lòng chọn tài khoản trước";
}

async function openGptOfficialLogin() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	if (!accountId) {
		toast.warning("Vui lòng chọn tài khoản trước");
		return;
	}
	const loginUrl = "https://chatgpt.com/auth/login";
	try {
		const data = await api.post("/payment/open-incognito", {
			url: loginUrl,
			account_id: accountId,
		});
		if (data?.success) {
			toast.success("Đã mở trang đăng nhập GPT chính thức ở chế độ ẩn danh");
			return;
		}
		window.open(loginUrl, "_blank", "noopener,noreferrer");
		toast.warning(
			data?.message ||
				"Không tìm thấy trình duyệt khả dụng, đã mở trong trình duyệt hiện tại",
		);
	} catch (error) {
		window.open(loginUrl, "_blank", "noopener,noreferrer");
		toast.warning(
			`Mở chế độ ẩn danh thất bại, đã mở trong trình duyệt hiện tại: ${formatErrorMessage(error)}`,
		);
	}
}

async function fetchSelectedAccountInbox() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	const email = getSelectedAccountEmail();
	if (!accountId || !email) {
		toast.warning("Vui lòng chọn tài khoản trước");
		return;
	}
	toast.info(`Đang kiểm tra hộp thư đến của ${email}...`);
	try {
		const result = await api.post(`/accounts/${accountId}/inbox-code`, {});
		if (result?.success && result?.code) {
			const code = String(result.code).trim();
			copyToClipboard(code);
			toast.success(
				`${email} - mã xác minh mới nhất: ${code} (đã sao chép)`,
				8000,
			);
			return;
		}
		toast.error(
			`Kiểm tra thất bại: ${result?.error || "Chưa nhận được mã xác minh"}`,
		);
	} catch (error) {
		toast.error(`Kiểm tra thất bại: ${formatErrorMessage(error)}`);
	}
}

function onBindModeChange() {
	const mode = getBindMode();
	const thirdPartyPanel = document.getElementById("third-party-config");
	if (thirdPartyPanel) {
		thirdPartyPanel.style.display = mode === "third_party" ? "" : "none";
	}

	const actionBtn = document.getElementById("create-bind-task-btn");
	if (actionBtn) {
		if (mode === "third_party") {
			actionBtn.textContent = "Tạo và chạy liên kết thẻ tự động qua bên thứ ba";
		} else if (mode === "local_auto") {
			actionBtn.textContent = "Tạo và chạy liên kết thẻ tự động hoàn toàn";
		} else {
			actionBtn.textContent =
				"Tạo và thêm vào tác vụ liên kết thẻ (bán tự động)";
		}
	}
	updateSemiAutoActionsVisibility(mode);
	updateSelectedAccountEmailLabel();
	storage.set(BIND_MODE_STORAGE_KEY, mode);
}

function collectThirdPartyConfig() {
	const apiUrl = getInputValue("third-party-api-url");
	const apiKey = getInputValue("third-party-api-key");
	return { api_url: apiUrl, api_key: apiKey };
}

function restoreBindModeConfig() {
	const modeSelect = document.getElementById("bind-mode-select");
	const savedMode = String(
		storage.get(BIND_MODE_STORAGE_KEY, "semi_auto") || "semi_auto",
	);
	if (modeSelect) {
		modeSelect.value = ["semi_auto", "third_party", "local_auto"].includes(
			savedMode,
		)
			? savedMode
			: "semi_auto";
	}

	const savedApiUrl = String(
		storage.get(THIRD_PARTY_BIND_URL_STORAGE_KEY, "") || "",
	).trim();
	const initialApiUrl = savedApiUrl || THIRD_PARTY_BIND_DEFAULT_URL;
	setInputValue("third-party-api-url", initialApiUrl);
	if (!savedApiUrl) {
		storage.set(THIRD_PARTY_BIND_URL_STORAGE_KEY, initialApiUrl);
	}
	onBindModeChange();
}

function switchPaymentTab(tab) {
	const isLink = tab === "link";
	document.getElementById("tab-btn-link")?.classList.toggle("active", isLink);
	document
		.getElementById("tab-btn-bind-task")
		?.classList.toggle("active", !isLink);
	document
		.getElementById("tab-content-link")
		?.classList.toggle("active", isLink);
	document
		.getElementById("tab-content-bind-task")
		?.classList.toggle("active", !isLink);
	if (!isLink) {
		loadBindCardTasks(true);
	}
}

function getCheckoutPayload() {
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	if (!accountId) {
		throw new Error("Vui lòng chọn tài khoản trước");
	}
	const payload = {
		account_id: accountId,
		plan_type: selectedPlan,
		country: (
			document.getElementById("country-select")?.value || "US"
		).toUpperCase(),
		currency: (
			document.getElementById("currency-display")?.value || "USD"
		).toUpperCase(),
	};
	if (selectedPlan === "team") {
		payload.workspace_name =
			document.getElementById("workspace-name")?.value || "MyTeam";
		payload.seat_quantity =
			Number(document.getElementById("seat-quantity")?.value || 5) || 5;
		payload.price_interval =
			document.getElementById("price-interval")?.value || "month";
	}
	return payload;
}

function showGeneratedLink(data) {
	generatedLink = data.link || "";
	const linkText = document.getElementById("link-text");
	const linkBox = document.getElementById("link-box");
	const statusEl = document.getElementById("open-status");
	if (!linkText || !linkBox || !statusEl) return;

	linkText.value = generatedLink;
	linkBox.classList.add("show");

	const source = data.source ? `Nguồn: ${data.source}` : "";
	const routeHint = data.is_official_checkout
		? "Đã lấy được liên kết checkout chính thức, có thể liên kết thẻ trực tiếp"
		: "Đây là liên kết trung chuyển, bấm “Mở trực tiếp trang thanh toán” để tiếp tục";
	statusEl.textContent = [source, routeHint].filter(Boolean).join(" | ");
}

document.addEventListener("DOMContentLoaded", () => {
	const countrySelect = document.getElementById("country-select");
	const currencyDisplay = document.getElementById("currency-display");
	if (countrySelect) {
		countrySelect.value = countrySelect.value || "US";
	}
	if (currencyDisplay) {
		currencyDisplay.value = currencyDisplay.value || "USD";
	}

	const searchInput = document.getElementById("bind-task-search");
	if (searchInput) {
		searchInput.addEventListener(
			"input",
			debounce(() => {
				bindTaskState.search = (searchInput.value || "").trim();
				bindTaskState.page = 1;
				loadBindCardTasks();
			}, 250),
		);
	}

	const statusSelect = document.getElementById("bind-task-status");
	if (statusSelect) {
		statusSelect.addEventListener("change", () => {
			bindTaskState.status = statusSelect.value || "";
			bindTaskState.page = 1;
			loadBindCardTasks();
		});
	}
	document.getElementById("account-select")?.addEventListener("change", () => {
		resetGenerateLinkButtonState();
		updateSelectedAccountEmailLabel();
	});

	bindBillingEvents();
	restoreBillingProfileNonSensitive();
	refreshBillingTemplateSelect();
	restoreBindModeConfig();

	document.getElementById("third-party-api-url")?.addEventListener(
		"input",
		debounce(() => {
			const apiUrl = getInputValue("third-party-api-url");
			storage.set(THIRD_PARTY_BIND_URL_STORAGE_KEY, apiUrl);
		}, 200),
	);
	document
		.getElementById("bind-mode-select")
		?.addEventListener("change", onBindModeChange);

	loadAccounts();
	onCountryChange();
	loadBindCardTasks();
	startBindTaskAutoRefresh();
	switchPaymentTab("link");

	window.addEventListener("beforeunload", stopBindTaskAutoRefresh);
});

// 加载账号列表
async function loadAccounts() {
	try {
		// 后端 page_size 最大为 100，超限会返回 422。
		// 这里读取账号管理列表，不按状态硬过滤，避免“有账号但选不到”。
		const data = await api.get("/accounts?page=1&page_size=100");
		const sel = document.getElementById("account-select");
		if (!sel) return;

		sel.innerHTML = '<option value="">-- Vui lòng chọn tài khoản --</option>';
		paymentAccounts = Array.isArray(data.accounts) ? data.accounts : [];
		(data.accounts || []).forEach((acc) => {
			const opt = document.createElement("option");
			opt.value = acc.id;
			const subText = acc.subscription_type
				? ` (${String(acc.subscription_type).toUpperCase()})`
				: "";
			opt.textContent = `${acc.email}${subText}`;
			sel.appendChild(opt);
		});
		updateSelectedAccountEmailLabel();
		updateSemiAutoActionsVisibility(getBindMode());
	} catch (e) {
		toast.error(`Tải tài khoản thất bại: ${formatErrorMessage(e)}`);
	}
}

// 国家切换
function onCountryChange() {
	const country = document.getElementById("country-select")?.value || "US";
	const currency = COUNTRY_CURRENCY_MAP[country] || "USD";
	const currencyEl = document.getElementById("currency-display");
	if (currencyEl) {
		currencyEl.value = currency;
	}
}

// 选择套餐
function selectPlan(plan) {
	selectedPlan = plan;
	document
		.getElementById("plan-plus")
		?.classList.toggle("selected", plan === "plus");
	document
		.getElementById("plan-team")
		?.classList.toggle("selected", plan === "team");
	document
		.getElementById("team-options")
		?.classList.toggle("show", plan === "team");

	// 切换套餐时隐藏已有链接，避免误用旧链接。
	document.getElementById("link-box")?.classList.remove("show");
	generatedLink = "";
	resetGenerateLinkButtonState();
}

// 生成支付链接
async function generateLink() {
	if (isGeneratingCheckoutLink) {
		return;
	}

	let payload;
	try {
		payload = getCheckoutPayload();
	} catch (err) {
		toast.warning(err.message || "Thiếu tham số");
		return;
	}

	isGeneratingCheckoutLink = true;
	setButtonLoading("generate-link-btn", "Đang tạo...", true);
	try {
		const data = await api.post("/payment/generate-link", payload);
		if (!data?.success || !data?.link) {
			throw new Error(data?.detail || "Tạo liên kết thất bại");
		}
		showGeneratedLink(data);
		toast.success("Đã tạo liên kết thanh toán thành công");
	} catch (e) {
		toast.error(`Tạo liên kết thất bại: ${formatErrorMessage(e)}`);
	} finally {
		isGeneratingCheckoutLink = false;
		setButtonLoading("generate-link-btn", "Đang tạo...", false);
		resetGenerateLinkButtonState();
	}
}

async function submitThirdPartyAutoBind(task, bindData) {
	const thirdParty = collectThirdPartyConfig();
	const apiUrl = String(thirdParty.api_url || "").trim();
	const apiKey = String(thirdParty.api_key || "").trim();
	if (apiUrl) {
		storage.set(THIRD_PARTY_BIND_URL_STORAGE_KEY, apiUrl);
	}

	const expYear = String(bindData.exp_year || "").replace(/\D/g, "");
	const payload = {
		api_url: apiUrl || undefined,
		api_key: apiKey || undefined,
		timeout_seconds: 180,
		interval_seconds: 10,
		card: {
			number: String(bindData.card_number || "").replace(/\D/g, ""),
			exp_month: String(bindData.exp_month || "")
				.replace(/\D/g, "")
				.padStart(2, "0")
				.slice(0, 2),
			exp_year: (expYear.slice(-2) || expYear || "").padStart(2, "0"),
			cvc: String(bindData.cvc || "")
				.replace(/\D/g, "")
				.slice(0, 4),
		},
		profile: {
			name: String(bindData.billing_name || "").trim(),
			email: String(task?.account_email || "").trim() || undefined,
			country: String(bindData.country_code || "US").toUpperCase(),
			line1: String(bindData.address_line1 || "").trim(),
			city: String(bindData.address_city || "").trim(),
			state: String(bindData.address_state || "").trim(),
			postal: String(bindData.postal_code || "").trim(),
		},
	};

	return api.post(
		`/payment/bind-card/tasks/${task.id}/auto-bind-third-party`,
		payload,
	);
}

async function submitLocalAutoBind(task, bindData) {
	const expYear = String(bindData.exp_year || "").replace(/\D/g, "");
	const payload = {
		browser_timeout_seconds: 220,
		post_submit_wait_seconds: 90,
		verify_timeout_seconds: 180,
		verify_interval_seconds: 10,
		headless: false,
		card: {
			number: String(bindData.card_number || "").replace(/\D/g, ""),
			exp_month: String(bindData.exp_month || "")
				.replace(/\D/g, "")
				.padStart(2, "0")
				.slice(0, 2),
			exp_year: (expYear.slice(-2) || expYear || "").padStart(2, "0"),
			cvc: String(bindData.cvc || "")
				.replace(/\D/g, "")
				.slice(0, 4),
		},
		profile: {
			name: String(bindData.billing_name || "").trim(),
			email: String(task?.account_email || "").trim() || undefined,
			country: String(bindData.country_code || "US").toUpperCase(),
			line1: String(bindData.address_line1 || "").trim(),
			city: String(bindData.address_city || "").trim(),
			state: String(bindData.address_state || "").trim(),
			postal: String(bindData.postal_code || "").trim(),
		},
	};
	return api.post(
		`/payment/bind-card/tasks/${task.id}/auto-bind-local`,
		payload,
	);
}

async function runLocalAutoBindInBackground(task, bindData) {
	try {
		const autoResult = await submitLocalAutoBind(task, bindData);
		if (autoResult?.verified) {
			toast.success(
				`Tác vụ #${task.id} liên kết thẻ tự động hoàn toàn đã xong: ${String(autoResult.subscription_type || "").toUpperCase()}`,
			);
		} else if (autoResult?.paid_confirmed) {
			toast.success(
				`Tác vụ #${task.id} đã xác nhận thanh toán, chờ đồng bộ gói thuê bao (có thể bấm “Đồng bộ gói”)`,
				7000,
			);
		} else if (autoResult?.pending || autoResult?.need_user_action) {
			const stage = String(
				autoResult?.local_auto?.stage ||
					autoResult?.local_auto?.error ||
					"challenge",
			).toUpperCase();
			toast.warning(
				`Tác vụ #${task.id} liên kết thẻ tự động hoàn toàn đã được gửi (${stage}), vui lòng hoàn tất xác minh trên trang thanh toán rồi bấm “Tôi đã thanh toán xong” hoặc “Đồng bộ gói”.`,
				9000,
			);
		} else {
			const sub = String(autoResult?.subscription_type || "free").toUpperCase();
			toast.warning(
				`Tác vụ #${task.id} liên kết thẻ tự động hoàn toàn đã chạy xong nhưng gói hiện tại là ${sub}, vui lòng đồng bộ lại sau`,
				7000,
			);
		}
	} catch (autoErr) {
		toast.error(
			`Tác vụ #${task.id} liên kết thẻ tự động hoàn toàn thất bại: ${formatErrorMessage(autoErr)}`,
		);
	} finally {
		try {
			await loadBindCardTasks();
		} catch (_) {
			// 忽略刷新异常，避免覆盖前面的业务提示
		}
	}
}

// 生成并创建绑卡任务
async function createBindCardTask() {
	let payload;
	try {
		payload = getCheckoutPayload();
	} catch (err) {
		toast.warning(err.message || "Thiếu tham số");
		return;
	}

	const bindMode = getBindMode();
	const bindData = collectBillingFormData();
	const missing = [];
	if (!bindData.card_number) missing.push("số thẻ");
	if (!bindData.exp_month || !bindData.exp_year) missing.push("hạn dùng");
	if (!bindData.cvc) missing.push("CVC");
	if (!bindData.billing_name) missing.push("họ tên");
	if (!bindData.address_line1) missing.push("địa chỉ");
	if (!bindData.postal_code) missing.push("mã bưu chính");
	if (missing.length && bindMode === "semi_auto") {
		toast.warning(
			`Thông tin liên kết thẻ chưa đầy đủ: ${missing.join(", ")} (lần này chỉ tạo tác vụ bán tự động, sẽ không chặn)`,
			5000,
		);
	}
	if (
		missing.length &&
		(bindMode === "third_party" || bindMode === "local_auto")
	) {
		const modeText =
			bindMode === "third_party"
				? "liên kết thẻ tự động qua bên thứ ba"
				: "liên kết thẻ tự động hoàn toàn";
		toast.warning(
			`${modeText} yêu cầu đủ thông tin: ${missing.join(", ")}`,
			5000,
		);
		return;
	}

	payload.auto_open = Boolean(
		document.getElementById("bind-auto-open")?.checked,
	);
	payload.bind_mode = bindMode;

	setButtonLoading("create-bind-task-btn", "Đang tạo...", true);
	try {
		const data = await api.post("/payment/bind-card/tasks", payload);
		if (!data?.success || !data?.task) {
			throw new Error(data?.detail || "Tạo tác vụ liên kết thẻ thất bại");
		}

		if (data.link) {
			showGeneratedLink({
				link: data.link,
				source: data.source,
				is_official_checkout: data.is_official_checkout,
			});
		}

		if (bindMode === "third_party") {
			toast.info(
				`Đã tạo tác vụ #${data.task.id}, đang gọi dịch vụ liên kết thẻ tự động qua bên thứ ba...`,
				3000,
			);
			try {
				const autoResult = await submitThirdPartyAutoBind(data.task, bindData);
				if (autoResult?.verified) {
					toast.success(
						`Tác vụ #${data.task.id} liên kết thẻ tự động đã xong: ${String(autoResult.subscription_type || "").toUpperCase()}`,
					);
				} else if (autoResult?.paid_confirmed) {
					toast.success(
						`Tác vụ #${data.task.id} đã xác nhận thanh toán, chờ đồng bộ gói thuê bao (có thể bấm “Đồng bộ gói”)`,
						7000,
					);
				} else if (autoResult?.pending || autoResult?.need_user_action) {
					const tp = autoResult?.third_party || {};
					const assess = tp?.assessment || {};
					const snapshot = assess?.snapshot || {};
					const paymentStatus =
						String(snapshot?.payment_status || "").toUpperCase() || "UNKNOWN";
					toast.warning(
						`Tác vụ #${data.task.id} đã được bên thứ ba tiếp nhận (payment_status=${paymentStatus}), có thể cần challenge; vui lòng hoàn tất trên trang thanh toán rồi bấm “Tôi đã thanh toán xong” hoặc “Đồng bộ gói”.`,
						9000,
					);
				} else {
					const sub = String(
						autoResult?.subscription_type || "free",
					).toUpperCase();
					toast.warning(
						`Tác vụ #${data.task.id} đã gửi sang bên thứ ba thành công nhưng gói hiện tại là ${sub}, vui lòng đồng bộ lại sau`,
						7000,
					);
				}
			} catch (autoErr) {
				toast.error(
					`Tác vụ #${data.task.id} liên kết thẻ tự động qua bên thứ ba thất bại: ${formatErrorMessage(autoErr)}`,
				);
			}
		} else if (bindMode === "local_auto") {
			toast.info(
				`Đã tạo tác vụ #${data.task.id}, đang chạy liên kết thẻ tự động hoàn toàn trong nền; bạn vẫn có thể chỉnh tham số và tạo tác vụ mới`,
				5000,
			);
			runLocalAutoBindInBackground(data.task, { ...bindData });
		} else {
			toast.success(
				`Đã tạo tác vụ liên kết thẻ #${data.task.id}${data.auto_opened ? ", trình duyệt đã được mở" : ""}`,
			);
		}
		switchPaymentTab("bind-task");
		await loadBindCardTasks();
	} catch (e) {
		toast.error(`Tạo tác vụ liên kết thẻ thất bại: ${formatErrorMessage(e)}`);
	} finally {
		setButtonLoading("create-bind-task-btn", "Đang tạo...", false);
	}
}

function copyLink() {
	if (!generatedLink) {
		toast.warning("Vui lòng tạo liên kết trước");
		return;
	}
	copyToClipboard(generatedLink);
}

// 在当前浏览器直接打开支付页（适合 Docker/远程部署场景）
function openCheckout() {
	if (!generatedLink) {
		toast.warning("Vui lòng tạo liên kết trước");
		return;
	}
	const w = window.open(generatedLink, "_blank", "noopener,noreferrer");
	if (!w) {
		window.location.href = generatedLink;
	}
}

// 无痕打开浏览器（携带账号 cookie）
async function openIncognito() {
	if (!generatedLink) {
		toast.warning("Vui lòng tạo liên kết trước");
		return;
	}
	const accountId = Number(
		document.getElementById("account-select")?.value || 0,
	);
	const statusEl = document.getElementById("open-status");
	if (statusEl) {
		statusEl.textContent = "Đang mở...";
	}
	try {
		const body = { url: generatedLink };
		if (accountId) body.account_id = accountId;
		const data = await api.post("/payment/open-incognito", body);
		if (data?.success) {
			if (statusEl) statusEl.textContent = "Đã mở trình duyệt ở chế độ ẩn danh";
			toast.success("Đã mở trình duyệt ẩn danh");
		} else {
			if (statusEl)
				statusEl.textContent =
					data?.message ||
					"Không tìm thấy trình duyệt khả dụng, vui lòng sao chép liên kết thủ công";
			toast.warning(data?.message || "Không tìm thấy trình duyệt khả dụng");
		}
	} catch (e) {
		if (statusEl)
			statusEl.textContent = `Yêu cầu thất bại: ${formatErrorMessage(e)}`;
		toast.error(`Yêu cầu thất bại: ${formatErrorMessage(e)}`);
	}
}

async function loadBindCardTasks(silent = false) {
	const tbody = document.getElementById("bind-card-task-table");
	if (!tbody) return;

	if (!silent) {
		setButtonLoading("refresh-bind-task-btn", "Đang làm mới...", true);
	}
	try {
		const params = new URLSearchParams({
			page: String(bindTaskState.page),
			page_size: String(bindTaskState.pageSize),
		});
		if (bindTaskState.status) params.set("status", bindTaskState.status);
		if (bindTaskState.search) params.set("search", bindTaskState.search);

		const data = await api.get(`/payment/bind-card/tasks?${params.toString()}`);
		const tasks = data?.tasks || [];

		if (!tasks.length) {
			tbody.innerHTML = `
                <tr>
					<td colspan="8"><div class="empty-state">Chưa có tác vụ liên kết thẻ</div></td>
                </tr>
            `;
			return;
		}

		tbody.innerHTML = tasks
			.map(
				(task) => `
            <tr>
                <td>${task.id}</td>
                <td>${escapeHtml(task.account_email || "-")}</td>
                <td>${String(task.plan_type || "-").toUpperCase()}</td>
                <td><span class="bind-task-badge ${escapeHtml(task.status || "")}">${escapeHtml(getTaskStatusText(task.status))}</span></td>
                <td>
                    <a class="bind-task-url" href="${escapeHtml(task.checkout_url || "#")}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(task.checkout_url || "")}">
                        ${escapeHtml(task.checkout_url || "-")}
                    </a>
                </td>
                <td>${escapeHtml(task.checkout_source || "-")}</td>
                <td>${format.date(task.created_at)}</td>
                <td>
                    <div class="bind-task-actions">
                        <button class="btn btn-primary bind-task-action-btn" onclick="openBindCardTask(${task.id})">Mở</button>
                        <button class="btn btn-primary bind-task-action-btn" onclick="markBindCardTaskUserAction(${task.id})">Tôi đã thanh toán xong</button>
                        <button class="btn btn-secondary bind-task-action-btn" onclick="syncBindCardTask(${task.id})">Đồng bộ gói</button>
                        <button class="btn btn-danger bind-task-action-btn" onclick="deleteBindCardTask(${task.id})">Xóa</button>
                    </div>
                    ${task.last_error ? `<div class="hint" style="margin-top:6px;color:var(--danger-color);" title="${escapeHtml(task.last_error)}">${escapeHtml(task.last_error)}</div>` : ""}
                </td>
            </tr>
        `,
			)
			.join("");
	} catch (e) {
		tbody.innerHTML = `
            <tr>
                <td colspan="8"><div class="empty-state">Tải thất bại: ${escapeHtml(formatErrorMessage(e))}</div></td>
            </tr>
        `;
	} finally {
		if (!silent) {
			setButtonLoading("refresh-bind-task-btn", "Đang làm mới...", false);
		}
	}
}

async function openBindCardTask(taskId) {
	try {
		const data = await api.post(`/payment/bind-card/tasks/${taskId}/open`, {});
		if (data?.success) {
			toast.success(`Đã thử mở tác vụ #${taskId}`);
			await loadBindCardTasks();
			return;
		}
		throw new Error(data?.detail || "Mở thất bại");
	} catch (e) {
		toast.error(`Mở tác vụ thất bại: ${formatErrorMessage(e)}`);
	}
}

async function markBindCardTaskUserAction(taskId) {
	try {
		toast.info(
			`Tác vụ #${taskId} đang xác minh gói thuê bao, tối đa chờ 180 giây...`,
			3000,
		);
		const data = await api.post(
			`/payment/bind-card/tasks/${taskId}/mark-user-action`,
			{
				timeout_seconds: 180,
				interval_seconds: 10,
			},
		);
		if (data?.verified) {
			toast.success(
				`Tác vụ #${taskId} xác minh thành công: ${String(data.subscription_type || "").toUpperCase()}`,
			);
		} else {
			const sub = String(data?.subscription_type || "free").toUpperCase();
			const source = String(data?.detail?.source || "unknown");
			const confidence = String(data?.detail?.confidence || "unknown");
			const note = String(data?.detail?.note || "");
			const suffix = note ? `, note=${note}` : "";
			toast.warning(
				`Tác vụ #${taskId} hiện chưa phát hiện gói thuê bao (hiện tại ${sub}, source=${source}, confidence=${confidence}${suffix}), đã chuyển lại sang trạng thái chờ người dùng hoàn tất`,
				7000,
			);
		}
		await loadBindCardTasks();
	} catch (e) {
		// 兼容旧后端：如果 mark-user-action 尚未部署，自动降级到 sync-subscription。
		const detail = String(e?.data?.detail || "").toLowerCase();
		const isRouteNotFound =
			e?.response?.status === 404 && detail === "not found";
		if (isRouteNotFound) {
			try {
				const fallback = await api.post(
					`/payment/bind-card/tasks/${taskId}/sync-subscription`,
					{},
				);
				const sub = String(fallback?.subscription_type || "free").toUpperCase();
				if (sub === "PLUS" || sub === "TEAM") {
					toast.success(
						`Tác vụ #${taskId} đã đồng bộ thành công ở chế độ tương thích: ${sub}`,
					);
				} else {
					toast.warning(
						`Tác vụ #${taskId} đã đồng bộ xong ở chế độ tương thích nhưng hiện vẫn là ${sub}`,
						5000,
					);
				}
				await loadBindCardTasks();
				return;
			} catch (fallbackErr) {
				toast.error(
					`Xác minh gói thuê bao thất bại (chế độ tương thích cũng thất bại): ${formatErrorMessage(fallbackErr)}`,
				);
				return;
			}
		}
		toast.error(`Xác minh gói thuê bao thất bại: ${formatErrorMessage(e)}`);
	}
}

async function syncBindCardTask(taskId) {
	try {
		const data = await api.post(
			`/payment/bind-card/tasks/${taskId}/sync-subscription`,
			{},
		);
		const sub = String(data?.subscription_type || "free").toUpperCase();
		const source = String(data?.detail?.source || "unknown");
		const confidence = String(data?.detail?.confidence || "unknown");
		const note = String(data?.detail?.note || "");
		const suffix = note ? `, note=${note}` : "";
		const msg = `Đồng bộ xong: ${sub} (source=${source}, confidence=${confidence}${suffix})`;
		if (sub === "PLUS" || sub === "TEAM") {
			toast.success(msg);
		} else {
			toast.warning(msg, 7000);
		}
		await loadBindCardTasks();
	} catch (e) {
		toast.error(`Đồng bộ gói thuê bao thất bại: ${formatErrorMessage(e)}`);
	}
}

async function deleteBindCardTask(taskId) {
	const ok = await confirm(
		`Xác nhận xóa tác vụ liên kết thẻ #${taskId}?`,
		"Xóa tác vụ",
	);
	if (!ok) return;

	try {
		await api.delete(`/payment/bind-card/tasks/${taskId}`);
		toast.success(`Đã xóa tác vụ #${taskId}`);
		await loadBindCardTasks();
	} catch (e) {
		toast.error(`Xóa tác vụ thất bại: ${formatErrorMessage(e)}`);
	}
}

window.selectPlan = selectPlan;
window.generateLink = generateLink;
window.createBindCardTask = createBindCardTask;
window.copyLink = copyLink;
window.openCheckout = openCheckout;
window.openIncognito = openIncognito;
window.onBindModeChange = onBindModeChange;
window.switchPaymentTab = switchPaymentTab;
window.loadBindCardTasks = loadBindCardTasks;
window.openBindCardTask = openBindCardTask;
window.markBindCardTaskUserAction = markBindCardTaskUserAction;
window.syncBindCardTask = syncBindCardTask;
window.deleteBindCardTask = deleteBindCardTask;
window.fillFromBatchProfile = fillFromBatchProfile;
window.randomBillingByCountry = randomBillingByCountry;
