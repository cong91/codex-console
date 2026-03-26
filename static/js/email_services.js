/**
 * 邮箱服务页面 JavaScript
 */

// 状态
let outlookServices = [];
let customServices = []; // 合并 moe_mail + temp_mail + duck_mail + freemail + imap_mail
const selectedOutlook = new Set();
const selectedCustom = new Set();

// DOM 元素
const elements = {
	// 统计
	outlookCount: document.getElementById("outlook-count"),
	customCount: document.getElementById("custom-count"),
	tempmailStatus: document.getElementById("tempmail-status"),
	totalEnabled: document.getElementById("total-enabled"),

	// Outlook 导入
	toggleOutlookImport: document.getElementById("toggle-outlook-import"),
	outlookImportBody: document.getElementById("outlook-import-body"),
	outlookImportData: document.getElementById("outlook-import-data"),
	outlookImportEnabled: document.getElementById("outlook-import-enabled"),
	outlookImportPriority: document.getElementById("outlook-import-priority"),
	outlookImportBtn: document.getElementById("outlook-import-btn"),
	clearImportBtn: document.getElementById("clear-import-btn"),
	importResult: document.getElementById("import-result"),

	// Outlook 列表
	outlookTable: document.getElementById("outlook-accounts-table"),
	selectAllOutlook: document.getElementById("select-all-outlook"),
	batchDeleteOutlookBtn: document.getElementById("batch-delete-outlook-btn"),

	// 自定义域名（合并）
	customTable: document.getElementById("custom-services-table"),
	addCustomBtn: document.getElementById("add-custom-btn"),
	selectAllCustom: document.getElementById("select-all-custom"),

	// 临时邮箱
	tempmailForm: document.getElementById("tempmail-form"),
	tempmailApi: document.getElementById("tempmail-api"),
	tempmailEnabled: document.getElementById("tempmail-enabled"),
	testTempmailBtn: document.getElementById("test-tempmail-btn"),

	// 添加自定义域名模态框
	addCustomModal: document.getElementById("add-custom-modal"),
	addCustomForm: document.getElementById("add-custom-form"),
	closeCustomModal: document.getElementById("close-custom-modal"),
	cancelAddCustom: document.getElementById("cancel-add-custom"),
	customSubType: document.getElementById("custom-sub-type"),
	addMoemailFields: document.getElementById("add-moemail-fields"),
	addTempmailFields: document.getElementById("add-tempmail-fields"),
	addDuckmailFields: document.getElementById("add-duckmail-fields"),
	addFreemailFields: document.getElementById("add-freemail-fields"),
	addImapFields: document.getElementById("add-imap-fields"),

	// 编辑自定义域名模态框
	editCustomModal: document.getElementById("edit-custom-modal"),
	editCustomForm: document.getElementById("edit-custom-form"),
	closeEditCustomModal: document.getElementById("close-edit-custom-modal"),
	cancelEditCustom: document.getElementById("cancel-edit-custom"),
	editMoemailFields: document.getElementById("edit-moemail-fields"),
	editTempmailFields: document.getElementById("edit-tempmail-fields"),
	editDuckmailFields: document.getElementById("edit-duckmail-fields"),
	editFreemailFields: document.getElementById("edit-freemail-fields"),
	editImapFields: document.getElementById("edit-imap-fields"),
	editCustomTypeBadge: document.getElementById("edit-custom-type-badge"),
	editCustomSubTypeHidden: document.getElementById(
		"edit-custom-sub-type-hidden",
	),

	// 编辑 Outlook 模态框
	editOutlookModal: document.getElementById("edit-outlook-modal"),
	editOutlookForm: document.getElementById("edit-outlook-form"),
	closeEditOutlookModal: document.getElementById("close-edit-outlook-modal"),
	cancelEditOutlook: document.getElementById("cancel-edit-outlook"),
};

const CUSTOM_SUBTYPE_LABELS = {
	moemail: "🔗 MoeMail (API domain tùy chỉnh)",
	tempmail: "📮 TempMail (Cloudflare Worker tự triển khai)",
	duckmail: "🦆 DuckMail (DuckMail API)",
	freemail: "Freemail (Cloudflare Worker tự triển khai)",
	imap: "📧 Email IMAP (Gmail/QQ/163...)",
};

// 初始化
document.addEventListener("DOMContentLoaded", () => {
	loadStats();
	loadOutlookServices();
	loadCustomServices();
	loadTempmailConfig();
	initEventListeners();
});

// 事件监听
function initEventListeners() {
	// Outlook 导入展开/收起
	elements.toggleOutlookImport.addEventListener("click", () => {
		const isHidden = elements.outlookImportBody.style.display === "none";
		elements.outlookImportBody.style.display = isHidden ? "block" : "none";
		elements.toggleOutlookImport.textContent = isHidden ? "Thu gọn" : "Mở rộng";
	});

	// Outlook 导入
	elements.outlookImportBtn.addEventListener("click", handleOutlookImport);
	elements.clearImportBtn.addEventListener("click", () => {
		elements.outlookImportData.value = "";
		elements.importResult.style.display = "none";
	});

	// Outlook 全选
	elements.selectAllOutlook.addEventListener("change", (e) => {
		const checkboxes = elements.outlookTable.querySelectorAll(
			'input[type="checkbox"][data-id]',
		);
		checkboxes.forEach((cb) => {
			cb.checked = e.target.checked;
			const id = parseInt(cb.dataset.id);
			if (e.target.checked) selectedOutlook.add(id);
			else selectedOutlook.delete(id);
		});
		updateBatchButtons();
	});

	// Outlook 批量删除
	elements.batchDeleteOutlookBtn.addEventListener(
		"click",
		handleBatchDeleteOutlook,
	);

	// 自定义域名全选
	elements.selectAllCustom.addEventListener("change", (e) => {
		const checkboxes = elements.customTable.querySelectorAll(
			'input[type="checkbox"][data-id]',
		);
		checkboxes.forEach((cb) => {
			cb.checked = e.target.checked;
			const id = parseInt(cb.dataset.id);
			if (e.target.checked) selectedCustom.add(id);
			else selectedCustom.delete(id);
		});
	});

	// 添加自定义域名
	elements.addCustomBtn.addEventListener("click", () => {
		elements.addCustomForm.reset();
		switchAddSubType("moemail");
		elements.addCustomModal.classList.add("active");
	});
	elements.closeCustomModal.addEventListener("click", () =>
		elements.addCustomModal.classList.remove("active"),
	);
	elements.cancelAddCustom.addEventListener("click", () =>
		elements.addCustomModal.classList.remove("active"),
	);
	elements.addCustomForm.addEventListener("submit", handleAddCustom);

	// 类型切换（添加表单）
	elements.customSubType.addEventListener("change", (e) =>
		switchAddSubType(e.target.value),
	);

	// 编辑自定义域名
	elements.closeEditCustomModal.addEventListener("click", () =>
		elements.editCustomModal.classList.remove("active"),
	);
	elements.cancelEditCustom.addEventListener("click", () =>
		elements.editCustomModal.classList.remove("active"),
	);
	elements.editCustomForm.addEventListener("submit", handleEditCustom);

	// 编辑 Outlook
	elements.closeEditOutlookModal.addEventListener("click", () =>
		elements.editOutlookModal.classList.remove("active"),
	);
	elements.cancelEditOutlook.addEventListener("click", () =>
		elements.editOutlookModal.classList.remove("active"),
	);
	elements.editOutlookForm.addEventListener("submit", handleEditOutlook);

	// 临时邮箱配置
	elements.tempmailForm.addEventListener("submit", handleSaveTempmail);
	elements.testTempmailBtn.addEventListener("click", handleTestTempmail);

	// 点击其他地方关闭更多菜单
	document.addEventListener("click", () => {
		document
			.querySelectorAll(".dropdown-menu.active")
			.forEach((m) => m.classList.remove("active"));
	});
}

function toggleEmailMoreMenu(btn) {
	const menu = btn.nextElementSibling;
	const isActive = menu.classList.contains("active");
	document
		.querySelectorAll(".dropdown-menu.active")
		.forEach((m) => m.classList.remove("active"));
	if (!isActive) menu.classList.add("active");
}

function closeEmailMoreMenu(el) {
	const menu = el.closest(".dropdown-menu");
	if (menu) menu.classList.remove("active");
}

// 切换添加表单子类型
function switchAddSubType(subType) {
	elements.customSubType.value = subType;
	elements.addMoemailFields.style.display = subType === "moemail" ? "" : "none";
	elements.addTempmailFields.style.display =
		subType === "tempmail" ? "" : "none";
	elements.addDuckmailFields.style.display =
		subType === "duckmail" ? "" : "none";
	elements.addFreemailFields.style.display =
		subType === "freemail" ? "" : "none";
	elements.addImapFields.style.display = subType === "imap" ? "" : "none";
}

// 切换编辑表单子类型显示
function switchEditSubType(subType) {
	elements.editCustomSubTypeHidden.value = subType;
	elements.editMoemailFields.style.display =
		subType === "moemail" ? "" : "none";
	elements.editTempmailFields.style.display =
		subType === "tempmail" ? "" : "none";
	elements.editDuckmailFields.style.display =
		subType === "duckmail" ? "" : "none";
	elements.editFreemailFields.style.display =
		subType === "freemail" ? "" : "none";
	elements.editImapFields.style.display = subType === "imap" ? "" : "none";
	elements.editCustomTypeBadge.textContent =
		CUSTOM_SUBTYPE_LABELS[subType] || CUSTOM_SUBTYPE_LABELS.moemail;
}

// 加载统计信息
async function loadStats() {
	try {
		const data = await api.get("/email-services/stats");
		elements.outlookCount.textContent = data.outlook_count || 0;
		elements.customCount.textContent =
			(data.custom_count || 0) +
			(data.temp_mail_count || 0) +
			(data.duck_mail_count || 0) +
			(data.freemail_count || 0) +
			(data.imap_mail_count || 0);
		elements.tempmailStatus.textContent = data.tempmail_available
			? "Khả dụng"
			: "Không khả dụng";
		elements.totalEnabled.textContent = data.enabled_count || 0;
	} catch (error) {
		console.error("Tải thống kê thất bại:", error);
	}
}

// 加载 Outlook 服务
async function loadOutlookServices() {
	try {
		const data = await api.get("/email-services?service_type=outlook");
		outlookServices = data.services || [];

		if (outlookServices.length === 0) {
			elements.outlookTable.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <div class="empty-state-title">Chưa có tài khoản Outlook</div>
                            <div class="empty-state-description">Hãy dùng chức năng import phía trên để thêm tài khoản</div>
                        </div>
                    </td>
                </tr>
            `;
			return;
		}

		elements.outlookTable.innerHTML = outlookServices
			.map(
				(service) => `
            <tr data-id="${service.id}">
                <td><input type="checkbox" data-id="${service.id}" ${selectedOutlook.has(service.id) ? "checked" : ""}></td>
                <td>${escapeHtml(service.config?.email || service.name)}</td>
                <td>
                    ${getOutlookAuthBadge(service)}
                </td>
                <td>
                    ${getOutlookRegistrationBadge(service)}
                </td>
                <td title="${service.enabled ? "Đã bật" : "Đã tắt"}">${service.enabled ? "✅" : "⭕"}</td>
                <td>${service.priority}</td>
                <td>${format.date(service.last_used)}</td>
                <td>
                    <div style="display:flex;gap:4px;align-items:center;white-space:nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="editOutlookService(${service.id})">Sửa</button>
                        <div class="dropdown" style="position:relative;">
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleEmailMoreMenu(this)">Khác</button>
                            <div class="dropdown-menu" style="min-width:80px;">
                                <a href="#" class="dropdown-item" onclick="event.preventDefault();closeEmailMoreMenu(this);toggleService(${service.id}, ${!service.enabled})">${service.enabled ? "Tắt" : "Bật"}</a>
                                <a href="#" class="dropdown-item" onclick="event.preventDefault();closeEmailMoreMenu(this);testService(${service.id})">Kiểm tra</a>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="deleteService(${service.id}, '${escapeHtml(service.name)}')">Xóa</button>
                    </div>
                </td>
            </tr>
        `,
			)
			.join("");
		elements.outlookTable
			.querySelectorAll('input[type="checkbox"][data-id]')
			.forEach((cb) => {
				cb.addEventListener("change", (e) => {
					const id = parseInt(e.target.dataset.id);
					if (e.target.checked) selectedOutlook.add(id);
					else selectedOutlook.delete(id);
					updateBatchButtons();
				});
			});
	} catch (error) {
		console.error("Tải dịch vụ Outlook thất bại:", error);
		elements.outlookTable.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Tải thất bại</div></div></td></tr>`;
	}
}

function getOutlookAuthBadge(service) {
	if (service.config?.has_oauth) {
		return '<span class="status-badge active">OAuth</span>';
	}
	return '<span class="status-badge pending">Mật khẩu</span>';
}

function getOutlookRegistrationBadge(service) {
	if (service.registration_status === "registered") {
		const suffix = service.registered_account_id
			? ` #${service.registered_account_id}`
			: "";
		return `<span class="status-badge active">Đã đăng ký${suffix}</span>`;
	}
	if (service.registration_status === "unregistered") {
		return '<span class="status-badge pending">Chưa đăng ký</span>';
	}
	return '<span class="status-badge">Không rõ</span>';
}

function getCustomServiceTypeBadge(subType) {
	if (subType === "moemail") {
		return '<span class="status-badge info">MoeMail</span>';
	}
	if (subType === "tempmail") {
		return '<span class="status-badge warning">TempMail</span>';
	}
	if (subType === "duckmail") {
		return '<span class="status-badge success">DuckMail</span>';
	}
	if (subType === "freemail") {
		return '<span class="status-badge" style="background-color:#9c27b0;color:white;">Freemail</span>';
	}
	return '<span class="status-badge" style="background-color:#0288d1;color:white;">IMAP</span>';
}

function getCustomServiceAddress(service) {
	if (service._subType === "imap") {
		const host = service.config?.host || "-";
		const emailAddr = service.config?.email || "";
		return `${escapeHtml(host)}<div style="color: var(--text-muted); margin-top: 4px;">${escapeHtml(emailAddr)}</div>`;
	}
	const baseUrl = service.config?.base_url || "-";
	const domain = service.config?.default_domain || service.config?.domain;
	if (!domain) {
		return escapeHtml(baseUrl);
	}
	return `${escapeHtml(baseUrl)}<div style="color: var(--text-muted); margin-top: 4px;">Domain mặc định: @${escapeHtml(domain)}</div>`;
}

// 加载自定义邮箱服务（moe_mail + temp_mail + duck_mail + freemail 合并）
async function loadCustomServices() {
	try {
		const [r1, r2, r3, r4, r5] = await Promise.all([
			api.get("/email-services?service_type=moe_mail"),
			api.get("/email-services?service_type=temp_mail"),
			api.get("/email-services?service_type=duck_mail"),
			api.get("/email-services?service_type=freemail"),
			api.get("/email-services?service_type=imap_mail"),
		]);
		customServices = [
			...(r1.services || []).map((s) => ({ ...s, _subType: "moemail" })),
			...(r2.services || []).map((s) => ({ ...s, _subType: "tempmail" })),
			...(r3.services || []).map((s) => ({ ...s, _subType: "duckmail" })),
			...(r4.services || []).map((s) => ({ ...s, _subType: "freemail" })),
			...(r5.services || []).map((s) => ({ ...s, _subType: "imap" })),
		];

		if (customServices.length === 0) {
			elements.customTable.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <div class="empty-state-title">Chưa có dịch vụ email tùy chỉnh</div>
                            <div class="empty-state-description">Nhấn nút “Thêm dịch vụ” để tạo dịch vụ mới</div>
                        </div>
                    </td>
                </tr>
            `;
			return;
		}

		elements.customTable.innerHTML = customServices
			.map((service) => {
				return `
            <tr data-id="${service.id}">
                <td><input type="checkbox" data-id="${service.id}" ${selectedCustom.has(service.id) ? "checked" : ""}></td>
                <td>${escapeHtml(service.name)}</td>
                <td>${getCustomServiceTypeBadge(service._subType)}</td>
                <td style="font-size: 0.75rem; min-width: 400px;">${getCustomServiceAddress(service)}</td>
                <td title="${service.enabled ? "Đã bật" : "Đã tắt"}">${service.enabled ? "✅" : "⭕"}</td>
                <td>${service.priority}</td>
                <td>${format.date(service.last_used)}</td>
                <td>
                    <div style="display:flex;gap:4px;align-items:center;white-space:nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="editCustomService(${service.id}, '${service._subType}')">Sửa</button>
                        <div class="dropdown" style="position:relative;">
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleEmailMoreMenu(this)">Khác</button>
                            <div class="dropdown-menu" style="min-width:80px;">
                                <a href="#" class="dropdown-item" onclick="event.preventDefault();closeEmailMoreMenu(this);toggleService(${service.id}, ${!service.enabled})">${service.enabled ? "Tắt" : "Bật"}</a>
                                <a href="#" class="dropdown-item" onclick="event.preventDefault();closeEmailMoreMenu(this);testService(${service.id})">Kiểm tra</a>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="deleteService(${service.id}, '${escapeHtml(service.name)}')">Xóa</button>
                    </div>
                </td>
            </tr>`;
			})
			.join("");

		elements.customTable
			.querySelectorAll('input[type="checkbox"][data-id]')
			.forEach((cb) => {
				cb.addEventListener("change", (e) => {
					const id = parseInt(e.target.dataset.id);
					if (e.target.checked) selectedCustom.add(id);
					else selectedCustom.delete(id);
				});
			});
	} catch (error) {
		console.error("Tải dịch vụ email tùy chỉnh thất bại:", error);
	}
}

// 加载临时邮箱配置
async function loadTempmailConfig() {
	try {
		const settings = await api.get("/settings");
		if (settings.tempmail) {
			elements.tempmailApi.value = settings.tempmail.api_url || "";
			elements.tempmailEnabled.checked = settings.tempmail.enabled !== false;
		}
	} catch (error) {
		// 忽略错误
	}
}

// Outlook 导入
async function handleOutlookImport() {
	const data = elements.outlookImportData.value.trim();
	if (!data) {
		toast.error("Vui lòng nhập dữ liệu import");
		return;
	}

	elements.outlookImportBtn.disabled = true;
	elements.outlookImportBtn.textContent = "Đang import...";

	try {
		const result = await api.post("/email-services/outlook/batch-import", {
			data: data,
			enabled: elements.outlookImportEnabled.checked,
			priority: parseInt(elements.outlookImportPriority.value) || 0,
		});

		elements.importResult.style.display = "block";
		elements.importResult.innerHTML = `
            <div class="import-stats">
                <span>✅ Import thành công: <strong>${result.success || 0}</strong></span>
                <span>❌ Thất bại: <strong>${result.failed || 0}</strong></span>
            </div>
            ${result.errors?.length ? `<div class="import-errors" style="margin-top: var(--spacing-sm);"><strong>Chi tiết lỗi:</strong><ul>${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul></div>` : ""}
        `;

		if (result.success > 0) {
			toast.success(`Đã import thành công ${result.success} tài khoản`);
			loadOutlookServices();
			loadStats();
			elements.outlookImportData.value = "";
		}
	} catch (error) {
		toast.error("Import thất bại: " + error.message);
	} finally {
		elements.outlookImportBtn.disabled = false;
		elements.outlookImportBtn.textContent = "📥 Bắt đầu import";
	}
}

// 添加自定义邮箱服务（根据子类型区分）
async function handleAddCustom(e) {
	e.preventDefault();
	const formData = new FormData(e.target);
	const subType = formData.get("sub_type");

	let serviceType, config;
	if (subType === "moemail") {
		serviceType = "moe_mail";
		config = {
			base_url: formData.get("api_url"),
			api_key: formData.get("api_key"),
			default_domain: formData.get("domain"),
		};
	} else if (subType === "tempmail") {
		serviceType = "temp_mail";
		config = {
			base_url: formData.get("tm_base_url"),
			admin_password: formData.get("tm_admin_password"),
			domain: formData.get("tm_domain"),
			enable_prefix: true,
		};
	} else if (subType === "duckmail") {
		serviceType = "duck_mail";
		config = {
			base_url: formData.get("dm_base_url"),
			api_key: formData.get("dm_api_key"),
			default_domain: formData.get("dm_domain"),
			password_length: parseInt(formData.get("dm_password_length"), 10) || 12,
		};
	} else if (subType === "freemail") {
		serviceType = "freemail";
		config = {
			base_url: formData.get("fm_base_url"),
			admin_token: formData.get("fm_admin_token"),
			domain: formData.get("fm_domain"),
		};
	} else {
		serviceType = "imap_mail";
		config = {
			host: formData.get("imap_host"),
			port: parseInt(formData.get("imap_port"), 10) || 993,
			use_ssl: formData.get("imap_use_ssl") !== "false",
			email: formData.get("imap_email"),
			password: formData.get("imap_password"),
		};
	}

	const data = {
		service_type: serviceType,
		name: formData.get("name"),
		config,
		enabled: formData.get("enabled") === "on",
		priority: parseInt(formData.get("priority")) || 0,
	};

	try {
		await api.post("/email-services", data);
		toast.success("Đã thêm dịch vụ thành công");
		elements.addCustomModal.classList.remove("active");
		e.target.reset();
		loadCustomServices();
		loadStats();
	} catch (error) {
		toast.error("Thêm dịch vụ thất bại: " + error.message);
	}
}

// 切换服务状态
async function toggleService(id, enabled) {
	try {
		await api.patch(`/email-services/${id}`, { enabled });
		toast.success(enabled ? "Đã bật" : "Đã tắt");
		loadOutlookServices();
		loadCustomServices();
		loadStats();
	} catch (error) {
		toast.error("Thao tác thất bại: " + error.message);
	}
}

// 测试服务
async function testService(id) {
	try {
		const result = await api.post(`/email-services/${id}/test`);
		if (result.success) toast.success("Kiểm tra thành công");
		else
			toast.error(
				"Kiểm tra thất bại: " + (result.error || "Lỗi không xác định"),
			);
	} catch (error) {
		toast.error("Kiểm tra thất bại: " + error.message);
	}
}

// 删除服务
async function deleteService(id, name) {
	const confirmed = await confirm(`Xác nhận xóa "${name}"?`);
	if (!confirmed) return;
	try {
		await api.delete(`/email-services/${id}`);
		toast.success("Đã xóa");
		selectedOutlook.delete(id);
		selectedCustom.delete(id);
		loadOutlookServices();
		loadCustomServices();
		loadStats();
	} catch (error) {
		toast.error("Xóa thất bại: " + error.message);
	}
}

// 批量删除 Outlook
async function handleBatchDeleteOutlook() {
	if (selectedOutlook.size === 0) return;
	const confirmed = await confirm(
		`Xác nhận xóa ${selectedOutlook.size} tài khoản đã chọn?`,
	);
	if (!confirmed) return;
	try {
		const result = await api.request("/email-services/outlook/batch", {
			method: "DELETE",
			body: Array.from(selectedOutlook),
		});
		toast.success(
			`Đã xóa thành công ${result.deleted || selectedOutlook.size} tài khoản`,
		);
		selectedOutlook.clear();
		loadOutlookServices();
		loadStats();
	} catch (error) {
		toast.error("Xóa thất bại: " + error.message);
	}
}

// 保存临时邮箱配置
async function handleSaveTempmail(e) {
	e.preventDefault();
	try {
		await api.post("/settings/tempmail", {
			api_url: elements.tempmailApi.value,
			enabled: elements.tempmailEnabled.checked,
		});
		toast.success("Đã lưu cấu hình");
	} catch (error) {
		toast.error("Lưu thất bại: " + error.message);
	}
}

// 测试临时邮箱
async function handleTestTempmail() {
	elements.testTempmailBtn.disabled = true;
	elements.testTempmailBtn.textContent = "Đang kiểm tra...";
	try {
		const result = await api.post("/email-services/test-tempmail", {
			api_url: elements.tempmailApi.value,
		});
		if (result.success) toast.success("Kết nối email tạm thời bình thường");
		else
			toast.error(
				"Kết nối thất bại: " + (result.error || "Lỗi không xác định"),
			);
	} catch (error) {
		toast.error("Kiểm tra thất bại: " + error.message);
	} finally {
		elements.testTempmailBtn.disabled = false;
		elements.testTempmailBtn.textContent = "🔌 Kiểm tra kết nối";
	}
}

// 更新批量按钮
function updateBatchButtons() {
	const count = selectedOutlook.size;
	elements.batchDeleteOutlookBtn.disabled = count === 0;
	elements.batchDeleteOutlookBtn.textContent =
		count > 0 ? `🗑️ Xóa mục đã chọn (${count})` : "🗑️ Xóa hàng loạt";
}

// HTML 转义
function escapeHtml(text) {
	if (!text) return "";
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// ============== 编辑功能 ==============

// 编辑自定义邮箱服务（支持 moemail / tempmail / duckmail）
async function editCustomService(id, subType) {
	try {
		const service = await api.get(`/email-services/${id}/full`);
		const resolvedSubType =
			subType ||
			(service.service_type === "temp_mail"
				? "tempmail"
				: service.service_type === "duck_mail"
					? "duckmail"
					: service.service_type === "freemail"
						? "freemail"
						: service.service_type === "imap_mail"
							? "imap"
							: "moemail");

		document.getElementById("edit-custom-id").value = service.id;
		document.getElementById("edit-custom-name").value = service.name || "";
		document.getElementById("edit-custom-priority").value =
			service.priority || 0;
		document.getElementById("edit-custom-enabled").checked = service.enabled;

		switchEditSubType(resolvedSubType);

		if (resolvedSubType === "moemail") {
			document.getElementById("edit-custom-api-url").value =
				service.config?.base_url || "";
			document.getElementById("edit-custom-api-key").value = "";
			document.getElementById("edit-custom-api-key").placeholder = service
				.config?.api_key
				? "Đã thiết lập, để trống để giữ nguyên"
				: "API Key";
			document.getElementById("edit-custom-domain").value =
				service.config?.default_domain || service.config?.domain || "";
		} else if (resolvedSubType === "tempmail") {
			document.getElementById("edit-tm-base-url").value =
				service.config?.base_url || "";
			document.getElementById("edit-tm-admin-password").value = "";
			document.getElementById("edit-tm-admin-password").placeholder = service
				.config?.admin_password
				? "Đã thiết lập, để trống để giữ nguyên"
				: "Vui lòng nhập mật khẩu Admin";
			document.getElementById("edit-tm-domain").value =
				service.config?.domain || "";
		} else if (resolvedSubType === "duckmail") {
			document.getElementById("edit-dm-base-url").value =
				service.config?.base_url || "";
			document.getElementById("edit-dm-api-key").value = "";
			document.getElementById("edit-dm-api-key").placeholder = service.config
				?.api_key
				? "Đã thiết lập, để trống để giữ nguyên"
				: "Vui lòng nhập API Key (tùy chọn)";
			document.getElementById("edit-dm-domain").value =
				service.config?.default_domain || "";
			document.getElementById("edit-dm-password-length").value =
				service.config?.password_length || 12;
		} else if (resolvedSubType === "freemail") {
			document.getElementById("edit-fm-base-url").value =
				service.config?.base_url || "";
			document.getElementById("edit-fm-admin-token").value = "";
			document.getElementById("edit-fm-admin-token").placeholder = service
				.config?.admin_token
				? "Đã thiết lập, để trống để giữ nguyên"
				: "Vui lòng nhập Admin Token";
			document.getElementById("edit-fm-domain").value =
				service.config?.domain || "";
		} else {
			document.getElementById("edit-imap-host").value =
				service.config?.host || "";
			document.getElementById("edit-imap-port").value =
				service.config?.port || 993;
			document.getElementById("edit-imap-use-ssl").value =
				service.config?.use_ssl !== false ? "true" : "false";
			document.getElementById("edit-imap-email").value =
				service.config?.email || "";
			document.getElementById("edit-imap-password").value = "";
			document.getElementById("edit-imap-password").placeholder = service.config
				?.password
				? "Đã thiết lập, để trống để giữ nguyên"
				: "Vui lòng nhập mật khẩu / mã ủy quyền";
		}

		elements.editCustomModal.classList.add("active");
	} catch (error) {
		toast.error("Lấy thông tin dịch vụ thất bại: " + error.message);
	}
}

// 保存编辑自定义邮箱服务
async function handleEditCustom(e) {
	e.preventDefault();
	const id = document.getElementById("edit-custom-id").value;
	const formData = new FormData(e.target);
	const subType = formData.get("sub_type");

	let config;
	if (subType === "moemail") {
		config = {
			base_url: formData.get("api_url"),
			default_domain: formData.get("domain"),
		};
		const apiKey = formData.get("api_key");
		if (apiKey && apiKey.trim()) config.api_key = apiKey.trim();
	} else if (subType === "tempmail") {
		config = {
			base_url: formData.get("tm_base_url"),
			domain: formData.get("tm_domain"),
			enable_prefix: true,
		};
		const pwd = formData.get("tm_admin_password");
		if (pwd && pwd.trim()) config.admin_password = pwd.trim();
	} else if (subType === "duckmail") {
		config = {
			base_url: formData.get("dm_base_url"),
			default_domain: formData.get("dm_domain"),
			password_length: parseInt(formData.get("dm_password_length"), 10) || 12,
		};
		const apiKey = formData.get("dm_api_key");
		if (apiKey && apiKey.trim()) config.api_key = apiKey.trim();
	} else if (subType === "freemail") {
		config = {
			base_url: formData.get("fm_base_url"),
			domain: formData.get("fm_domain"),
		};
		const token = formData.get("fm_admin_token");
		if (token && token.trim()) config.admin_token = token.trim();
	} else {
		config = {
			host: formData.get("imap_host"),
			port: parseInt(formData.get("imap_port"), 10) || 993,
			use_ssl: formData.get("imap_use_ssl") !== "false",
			email: formData.get("imap_email"),
		};
		const pwd = formData.get("imap_password");
		if (pwd && pwd.trim()) config.password = pwd.trim();
	}

	const updateData = {
		name: formData.get("name"),
		priority: parseInt(formData.get("priority")) || 0,
		enabled: formData.get("enabled") === "on",
		config,
	};

	try {
		await api.patch(`/email-services/${id}`, updateData);
		toast.success("Cập nhật dịch vụ thành công");
		elements.editCustomModal.classList.remove("active");
		loadCustomServices();
		loadStats();
	} catch (error) {
		toast.error("Cập nhật thất bại: " + error.message);
	}
}

// 编辑 Outlook 服务
async function editOutlookService(id) {
	try {
		const service = await api.get(`/email-services/${id}/full`);
		document.getElementById("edit-outlook-id").value = service.id;
		document.getElementById("edit-outlook-email").value =
			service.config?.email || service.name || "";
		document.getElementById("edit-outlook-password").value = "";
		document.getElementById("edit-outlook-password").placeholder = service
			.config?.password
			? "Đã thiết lập, để trống để giữ nguyên"
			: "Vui lòng nhập mật khẩu";
		document.getElementById("edit-outlook-client-id").value =
			service.config?.client_id || "";
		document.getElementById("edit-outlook-refresh-token").value = "";
		document.getElementById("edit-outlook-refresh-token").placeholder = service
			.config?.refresh_token
			? "Đã thiết lập, để trống để giữ nguyên"
			: "Mã làm mới OAuth";
		document.getElementById("edit-outlook-priority").value =
			service.priority || 0;
		document.getElementById("edit-outlook-enabled").checked = service.enabled;
		elements.editOutlookModal.classList.add("active");
	} catch (error) {
		toast.error("Lấy thông tin dịch vụ thất bại: " + error.message);
	}
}

// 保存编辑 Outlook 服务
async function handleEditOutlook(e) {
	e.preventDefault();
	const id = document.getElementById("edit-outlook-id").value;
	const formData = new FormData(e.target);

	let currentService;
	try {
		currentService = await api.get(`/email-services/${id}/full`);
	} catch (error) {
		toast.error("Lấy thông tin dịch vụ thất bại");
		return;
	}

	const updateData = {
		name: formData.get("email"),
		priority: parseInt(formData.get("priority")) || 0,
		enabled: formData.get("enabled") === "on",
		config: {
			email: formData.get("email"),
			password:
				formData.get("password")?.trim() ||
				currentService.config?.password ||
				"",
			client_id:
				formData.get("client_id")?.trim() ||
				currentService.config?.client_id ||
				"",
			refresh_token:
				formData.get("refresh_token")?.trim() ||
				currentService.config?.refresh_token ||
				"",
		},
	};

	try {
		await api.patch(`/email-services/${id}`, updateData);
		toast.success("Cập nhật tài khoản thành công");
		elements.editOutlookModal.classList.remove("active");
		loadOutlookServices();
		loadStats();
	} catch (error) {
		toast.error("Cập nhật thất bại: " + error.message);
	}
}
