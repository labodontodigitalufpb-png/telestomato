    const TOKEN_KEY = "teleestomato_debug_token";
    let currentUser = null;
    let activeMediaGallery = [];
    let activeMediaIndex = -1;
    let dashboardAutoRefreshTimer = null;
    let notificationsCache = [];

    function $(id) {
      return document.getElementById(id);
    }

    function showMessage(message, type) {
      const el = $("message");
      el.textContent = message;
      el.className = "message show " + type;
    }

    function showResult(data) {
      const el = $("result");
      if (!el) return;
      el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    }

    function setText(id, value) {
      const el = $(id);
      if (el) el.textContent = value == null || value === "" ? "-" : String(value);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function getRoleLabel(role) {
      const labels = {
        DENTIST: "Profissional",
        TELECONSULTANT: "Teleconsultor",
        PATHOLOGIST: "Patologista",
        REGULATOR: "Telerregulador",
        ADMIN: "Administrador"
      };
      return labels[role] || role || "-";
    }

    function formatClinicalStatus(status) {
      const key = String(status || "").toLowerCase();
      const labels = {
        draft: "Rascunho",
        submitted: "Submetido",
        assigned: "Em revisão",
        answered: "Respondido",
        closed: "Fechado",
      };
      return labels[key] || status || "-";
    }

    function formatRegulationStatus(status) {
      const key = String(status || "").toLowerCase();
      const labels = {
        none: "Não iniciado",
        pending: "Pendente",
        in_review: "Em revisão",
        completed: "Respondido",
      };
      return labels[key] || status || "-";
    }

    function getCurrentRole() {
      return currentUser?.role || null;
    }

    function renderDetailCards(id, items, emptyMessage) {
      const el = $(id);
      if (!el) return;
      const validItems = items.filter((item) => item && item.body);
      if (!validItems.length) {
        el.innerHTML = `<div class="detail-card muted">${escapeHtml(emptyMessage)}</div>`;
        return;
      }
      el.innerHTML = validItems
        .map(
          (item) => `
            <div class="detail-card">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.body)}</p>
            </div>
          `
        )
        .join("");
    }

    function renderTimeline(id, items, emptyMessage) {
      const el = $(id);
      if (!el) return;
      if (!items.length) {
        el.innerHTML = `<div class="timeline-item muted"><strong>${escapeHtml(emptyMessage)}</strong></div>`;
        return;
      }
      el.innerHTML = items
        .map(
          (item) => `
            <div class="timeline-item">
              <span>${escapeHtml(item.meta)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.body)}</p>
            </div>
          `
        )
        .join("");
    }

    function renderMiniChart(id, rows, emptyMessage) {
      const el = $(id);
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = `<div class="chart-empty">${escapeHtml(emptyMessage)}</div>`;
        return;
      }
      const maxValue = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
      el.innerHTML = rows
        .map((row) => {
          const pct = Math.max(6, Math.round(((Number(row.value) || 0) / maxValue) * 100));
          return `
            <div class="chart-row">
              <div class="chart-label">${escapeHtml(row.label)}</div>
              <div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div>
              <div class="chart-value">${escapeHtml(row.value)}</div>
            </div>
          `;
        })
        .join("");
    }

    function buildMediaUrl(caseId, mediaId) {
      const token = localStorage.getItem(TOKEN_KEY);
      const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";
      return `${window.location.origin}/cases/${caseId}/media/${mediaId}/file${tokenQuery}`;
    }

    function getMediaKind(item) {
      const type = String(item.content_type || "");
      if (type.startsWith("image/")) return "image";
      if (type.startsWith("video/")) return "video";
      if (type === "application/pdf") return "pdf";
      return "file";
    }

    function getMediaKindLabel(item) {
      const kind = getMediaKind(item);
      if (kind === "image") return "Imagem";
      if (kind === "video") return "Video";
      if (kind === "pdf") return "PDF";
      return "Arquivo";
    }

    function renderLightboxItem(item) {
      const body = $("mediaLightboxBody");
      const url = buildMediaUrl(item.caseId, item.id);
      const kind = getMediaKind(item);
      const meta = `${getMediaKindLabel(item)} • ${formatDateTime(item.uploaded_at)}`;
      $("lightboxTitle").textContent = item.original_filename || `Arquivo ${item.id}`;
      $("lightboxMeta").textContent = meta;
      $("lightboxDownload").href = url;
      $("lightboxDownload").download = item.original_filename || `arquivo-${item.id}`;
      if (kind === "image") {
        body.innerHTML = `<img id="lightboxImage" class="lightbox-image" src="${escapeHtml(url)}" alt="${escapeHtml(item.original_filename || "Imagem do caso")}" onclick="toggleLightboxZoom()" />`;
      } else if (kind === "video") {
        body.innerHTML = `<video class="lightbox-video" src="${escapeHtml(url)}" controls preload="metadata"></video>`;
      } else {
        body.innerHTML = `
          <div class="lightbox-file">
            <strong>${escapeHtml(getMediaKindLabel(item))}</strong>
            <p>Abra o arquivo em uma nova aba para visualizar o conteúdo completo.</p>
            <a class="primary lightbox-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir arquivo</a>
          </div>
        `;
      }
      $("mediaLightbox").classList.remove("hidden");
      document.body.classList.add("modal-open");
    }

    function openMediaLightboxByIndex(index) {
      if (index < 0 || index >= activeMediaGallery.length) return;
      activeMediaIndex = index;
      renderLightboxItem(activeMediaGallery[index]);
    }

    function openMediaLightbox(caseId, mediaId) {
      const box = $("mediaLightbox");
      if (!box) return;
      const index = activeMediaGallery.findIndex((item) => item.caseId === caseId && item.id === mediaId);
      openMediaLightboxByIndex(index);
    }

    function closeMediaLightbox(event) {
      if (event && event.target && event.target !== $("mediaLightbox")) return;
      $("mediaLightbox").classList.add("hidden");
      $("mediaLightboxBody").innerHTML = "";
      document.body.classList.remove("modal-open");
    }

    function lightboxPrev() {
      if (!activeMediaGallery.length) return;
      const nextIndex = (activeMediaIndex - 1 + activeMediaGallery.length) % activeMediaGallery.length;
      openMediaLightboxByIndex(nextIndex);
    }

    function lightboxNext() {
      if (!activeMediaGallery.length) return;
      const nextIndex = (activeMediaIndex + 1) % activeMediaGallery.length;
      openMediaLightboxByIndex(nextIndex);
    }

    function toggleLightboxZoom() {
      const image = $("lightboxImage");
      if (!image) return;
      image.classList.toggle("zoomed");
    }

    function downloadMedia(caseId, mediaId, filename) {
      const link = document.createElement("a");
      link.href = buildMediaUrl(caseId, mediaId);
      link.download = filename || `arquivo-${mediaId}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    function isPdfMedia(item) {
      const contentType = String(item?.content_type || "").toLowerCase();
      const name = String(item?.original_filename || "").toLowerCase();
      return contentType === "application/pdf" || name.endsWith(".pdf");
    }

    function splitMicroscopicReportMedia(mediaItems, caseData) {
      const items = Array.isArray(mediaItems) ? mediaItems : [];
      const pathologistUserId = Number(caseData?.pathologist_user_id || 0);
      let microscopicReports = items.filter((item) => {
        if (!isPdfMedia(item)) return false;
        if (!pathologistUserId) return false;
        return Number(item?.uploader_user_id || 0) === pathologistUserId;
      });
      // Compatibilidade: PDFs antigos (antes de salvar uploader_user_id) podem ficar sem autor.
      // Se não houver match por autor, usamos PDFs de exame como melhor aproximação do laudo.
      if (!microscopicReports.length) {
        microscopicReports = items.filter((item) => isPdfMedia(item) && String(item?.media_type || "") === "exam");
      }
      const reportIds = new Set(microscopicReports.map((item) => item.id));
      const otherMedia = items.filter((item) => !reportIds.has(item.id));
      return { microscopicReports, otherMedia };
    }

    function renderMicroscopicReports(id, caseId, mediaItems, emptyMessage) {
      const el = $(id);
      if (!el) return;
      if (!mediaItems || !mediaItems.length) {
        el.innerHTML = `<div class="detail-card muted">${escapeHtml(emptyMessage)}</div>`;
        return;
      }
      const sorted = [...mediaItems].sort((a, b) => {
        const da = new Date(a.uploaded_at || 0).getTime();
        const db = new Date(b.uploaded_at || 0).getTime();
        return db - da;
      });
      el.innerHTML = sorted
        .map((item) => {
          const label = item.original_filename || `Laudo histopatológico ${item.id}.pdf`;
          const url = buildMediaUrl(caseId, item.id);
          return `
            <div class="detail-card">
              <strong>${escapeHtml(label)}</strong>
              <p>PDF • ${escapeHtml(formatDateTime(item.uploaded_at))}</p>
              <div class="actions">
                <button class="soft" type="button" onclick="downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Baixar PDF</button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    function renderMediaGallery(id, caseId, mediaItems, emptyMessage) {
      const el = $(id);
      if (!el) return;
      if (!mediaItems || !mediaItems.length) {
        el.innerHTML = `<div class="media-empty">${escapeHtml(emptyMessage)}</div>`;
        return;
      }
      const sortedItems = [...mediaItems].sort((a, b) => {
        const da = new Date(a.uploaded_at || 0).getTime();
        const db = new Date(b.uploaded_at || 0).getTime();
        return db - da;
      });
      activeMediaGallery = sortedItems.map((item) => ({ ...item, caseId }));
      el.innerHTML = sortedItems
        .map((item, index) => {
          const fileUrl = buildMediaUrl(caseId, item.id);
          const kind = getMediaKind(item);
          const label = item.original_filename || `Arquivo ${item.id}`;
          const meta = `${getMediaKindLabel(item)} • ${formatDateTime(item.uploaded_at)}`;
          if (kind === "image") {
            return `
              <button class="media-card" type="button" onclick="openMediaLightboxByIndex(${index})">
                <img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(label)}" />
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(meta)}</span>
                <button class="media-download" type="button" onclick="event.stopPropagation(); downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Baixar</button>
              </button>
            `;
          }
          if (kind === "video") {
            return `
              <button class="media-card file" type="button" onclick="openMediaLightboxByIndex(${index})">
                <strong>${escapeHtml(getMediaKindLabel(item))}</strong>
                <span>${escapeHtml(label)}</span>
                <small>${escapeHtml(meta)}</small>
                <button class="media-download" type="button" onclick="event.stopPropagation(); downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Baixar</button>
              </button>
            `;
          }
          return `
            <button class="media-card file" type="button" onclick="openMediaLightboxByIndex(${index})">
              <strong>${escapeHtml(getMediaKindLabel(item))}</strong>
              <span>${escapeHtml(label)}</span>
              <small>${escapeHtml(meta)}</small>
              <button class="media-download" type="button" onclick="event.stopPropagation(); downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Baixar</button>
            </button>
          `;
        })
        .join("");
    }

    function formatDateTime(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("pt-BR");
    }

    function renderChatMessages(messages) {
      const thread = $("chat_thread");
      if (!thread) return;
      if (!messages.length) {
        thread.innerHTML = `<div class="chat-empty">Nenhuma mensagem carregada.</div>`;
        setText("chat_status", "Nenhuma mensagem neste caso ainda.");
        return;
      }
      thread.innerHTML = messages
        .map((item) => {
          const isMine = currentUser && item.author_user_id === currentUser.id;
          const authorLabel = isMine ? "Você" : `Usuário ${item.author_user_id}`;
          return `
            <div class="chat-bubble ${isMine ? "mine" : "theirs"}">
              <span>${escapeHtml(authorLabel)} • ${escapeHtml(formatDateTime(item.created_at))}</span>
              <p>${escapeHtml(item.message)}</p>
            </div>
          `;
        })
        .join("");
      setText("chat_status", `${messages.length} mensagem(ns) carregada(s).`);
    }

    function fillTeleCaseContext(data) {
      setText("tele_ctx_patient", data?.patient_name);
      setText("tele_ctx_status", formatClinicalStatus(data?.status));
      setText("tele_ctx_topography", data?.lesion_topography);
      setText("tele_ctx_dentist_hypothesis", data?.dentist_hypotheses);
      setText("tele_ctx_complaint", data?.chief_complaint || "Carregue um caso para visualizar o contexto clínico.");
      setText("tele_ctx_oral", data?.oral_description);
      renderDetailCards(
        "tele_ctx_clinical",
        [
          { title: "História da doença atual", body: data?.hpi },
          { title: "História médica", body: data?.medical_history },
          { title: "História odontológica", body: data?.dental_history },
          { title: "Hábitos", body: data?.habits },
          { title: "Medicações", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descrição clínica oral", body: data?.oral_description },
        ],
        "Carregue um caso para visualizar a anamnese completa."
      );
      const teleMedia = splitMicroscopicReportMedia(data?.media || [], data);
      renderMicroscopicReports(
        "tele_ctx_micro_report",
        data?.id,
        teleMedia.microscopicReports,
        "Nenhum laudo histopatológico (PDF) carregado."
      );
      renderMediaGallery("tele_ctx_media", data?.id, teleMedia.otherMedia, "Nenhuma mídia carregada para este caso.");
      renderDetailCards(
        "tele_ctx_pathology",
        [
          { title: "Diagnóstico histopatológico", body: data?.pathology_diagnosis },
          { title: "Laudo enviado", body: data?.pathology_report },
        ],
        "Nenhum laudo enviado ainda."
      );

      if (!data) return;
      $("tele_case_id").value = data.id || $("tele_case_id").value;
      if (data.consultant_hypothesis) $("tele_hypothesis").value = data.consultant_hypothesis;
      if (data.consultant_summary) $("tele_summary").value = data.consultant_summary;
      if (data.consultant_hypotheses) $("tele_hypotheses").value = data.consultant_hypotheses;
      if (data.consultant_conduct) $("tele_conduct").value = data.consultant_conduct;
      if (data.consultant_care_coordination) $("tele_care").value = data.consultant_care_coordination;
      if (data.consultant_bibliography) $("tele_bibliography").value = data.consultant_bibliography;
      if (data.consultant_is_malignant === true) $("tele_malignant").value = "true";
      if (data.consultant_is_malignant === false) $("tele_malignant").value = "false";
    }

    function fillRegulationCaseContext(data) {
      setText("reg_ctx_patient", data?.patient_name);
      setText("reg_ctx_patient_phone", data?.patient_phone);
      setText("reg_ctx_case_status", formatClinicalStatus(data?.status));
      setText("reg_ctx_reg_status", formatRegulationStatus(data?.regulation_status));
      setText("reg_ctx_malignant", data?.consultant_is_malignant == null ? "-" : (data.consultant_is_malignant ? "Sim" : "Não"));
      setText("reg_ctx_hypothesis", data?.consultant_hypothesis || data?.consultant_hypotheses || "Carregue um caso para visualizar a síntese do teleconsultor.");
      setText("reg_ctx_conduct", [data?.consultant_conduct, data?.consultant_care_coordination].filter(Boolean).join(" | "));
      setText("reg_ctx_notes", data?.regulation_notes);
      renderDetailCards(
        "reg_ctx_clinical",
        [
          { title: "Queixa principal", body: data?.chief_complaint },
          { title: "História da doença atual", body: data?.hpi },
          { title: "História médica", body: data?.medical_history },
          { title: "História odontológica", body: data?.dental_history },
          { title: "Hábitos", body: data?.habits },
          { title: "Medicações", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descrição clínica oral", body: data?.oral_description },
        ],
        "Carregue um caso para visualizar a anamnese completa."
      );
      const regMedia = splitMicroscopicReportMedia(data?.media || [], data);
      renderMicroscopicReports(
        "reg_ctx_micro_report",
        data?.id,
        regMedia.microscopicReports,
        "Nenhum laudo histopatológico (PDF) carregado."
      );
      renderMediaGallery("reg_ctx_media", data?.id, regMedia.otherMedia, "Nenhuma mídia carregada para este caso.");

      if (!data) return;
      $("reg_case_id").value = data.id || $("reg_case_id").value;
      if (data.regulation_notes) $("reg_notes").value = data.regulation_notes;
      $("reg_microscopic_report_date").value = data.microscopic_report_date || "";
      $("reg_followup_1m").value = data.followup_1m_head_neck_seen == null ? "" : String(data.followup_1m_head_neck_seen);
      $("reg_followup_3m").value = data.followup_3m_initial_treatment_done == null ? "" : String(data.followup_3m_initial_treatment_done);
      $("reg_followup_6m_status").value = data.followup_6m_status || "";
      $("reg_followup_1y_status").value = data.followup_1y_status || "";
      $("reg_followup_barriers").value = data.followup_main_barriers || "";
    }

    function fillCaseDetailContext(data) {
      setText("case_ctx_id", data?.id);
      setText("case_ctx_status", formatClinicalStatus(data?.status));
      setText("case_ctx_patient", data?.patient_name);
      setText("case_ctx_topography", data?.lesion_topography);
      setText("case_ctx_complaint", data?.chief_complaint || "Abra um caso para acompanhar a resposta da teleconsultoria.");
      renderDetailCards(
        "case_ctx_clinical",
        [
          { title: "História da doença atual", body: data?.hpi },
          { title: "História médica", body: data?.medical_history },
          { title: "História odontológica", body: data?.dental_history },
          { title: "Hábitos", body: data?.habits },
          { title: "Medicações", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descrição clínica oral", body: data?.oral_description },
          { title: "Hipóteses do solicitante", body: data?.dentist_hypotheses },
        ],
        "Abra um caso para visualizar a anamnese completa."
      );
      const caseMedia = splitMicroscopicReportMedia(data?.media || [], data);
      renderMicroscopicReports(
        "case_ctx_micro_report",
        data?.id,
        caseMedia.microscopicReports,
        "Nenhum laudo histopatológico (PDF) carregado."
      );
      renderMediaGallery("case_ctx_media", data?.id, caseMedia.otherMedia, "Nenhuma mídia carregada para este caso.");

      renderDetailCards(
        "case_ctx_consultant",
        [
          { title: "Hipótese principal", body: data?.consultant_hypothesis },
          { title: "Síntese clínica", body: data?.consultant_summary },
          { title: "Hipóteses justificadas", body: data?.consultant_hypotheses },
          { title: "Bibliografia", body: data?.consultant_bibliography },
        ],
        "Nenhuma resposta registrada ainda."
      );

      renderDetailCards(
        "case_ctx_conduct",
        [
          { title: "Conduta clínica", body: data?.consultant_conduct },
          { title: "Coordenação do cuidado", body: data?.consultant_care_coordination },
        ],
        "-"
      );

      renderDetailCards(
        "case_ctx_regulation",
        [
          { title: "Status regulatório", body: formatRegulationStatus(data?.regulation_status) },
          {
            title: "Suspeita de malignidade",
            body: data?.consultant_is_malignant == null ? "" : (data.consultant_is_malignant ? "Sim" : "Não"),
          },
          { title: "Notas regulatórias", body: data?.regulation_notes },
          { title: "Data do laudo histopatológico", body: data?.microscopic_report_date },
          {
            title: "Follow-up 1 mês (cabeça e pescoço)",
            body: data?.followup_1m_head_neck_seen == null ? "" : (data.followup_1m_head_neck_seen ? "Sim" : "Não"),
          },
          {
            title: "Follow-up 3 meses (tratamento inicial)",
            body: data?.followup_3m_initial_treatment_done == null ? "" : (data.followup_3m_initial_treatment_done ? "Sim" : "Não"),
          },
          { title: "Follow-up 6 meses", body: data?.followup_6m_status },
          { title: "Follow-up 1 ano", body: data?.followup_1y_status },
          { title: "Principais barreiras", body: data?.followup_main_barriers },
        ],
        "Sem atualização regulatória no momento."
      );

      renderDetailCards(
        "case_ctx_pathology",
        [
          { title: "Diagnóstico histopatológico", body: data?.pathology_diagnosis },
          { title: "Laudo enviado", body: data?.pathology_report },
        ],
        "Nenhum laudo enviado ainda."
      );
    }

    function fillCaseFormForEdit(data) {
      if (!data) return;
      const setValue = (id, value) => {
        const el = $(id);
        if (!el) return;
        el.value = value == null ? "" : String(value);
      };

      setValue("case_dentist_state", data.dentist_state || "");
      setValue("case_dentist_municipality", data.dentist_municipality || "");
      setValue("case_unit_name", data.unit_name || "");
      setValue("case_patient_name", data.patient_name || "");
      setValue("case_sus_card", data.sus_card || "");
      setValue("case_patient_phone", data.patient_phone || "");
      setValue("case_patient_sex", data.patient_sex || "");
      setValue("case_patient_age", data.patient_age ?? "");
      setValue("case_patient_city", data.patient_city || "");
      setValue("case_patient_state", data.patient_state || "");
      setValue("case_lesion_topography", data.lesion_topography || "");
      setValue("case_is_biopsied", data.is_biopsied ? "true" : "false");
      setValue("case_chief_complaint", data.chief_complaint || "");
      setValue("case_hpi", data.hpi || "");
      setValue("case_medical_history", data.medical_history || "");
      setValue("case_dental_history", data.dental_history || "");
      setValue("case_habits", data.habits || "");
      setValue("case_meds_history", data.meds_history || "");
      setValue("case_vitals", data.vitals || "");
      setValue("case_oral_description", data.oral_description || "");
      setValue("case_dentist_hypotheses", data.dentist_hypotheses || "");
    }

    function fillPathologyCaseContext(data) {
      setText("path_ctx_patient", data?.patient_name);
      setText("path_ctx_status", formatClinicalStatus(data?.status));
      setText("path_ctx_topography", data?.lesion_topography);
      setText("path_ctx_dentist_hypothesis", data?.dentist_hypotheses);
      setText("path_ctx_complaint", data?.chief_complaint || "Carregue um caso para visualizar o contexto clínico.");
      renderDetailCards(
        "path_ctx_clinical",
        [
          { title: "História da doença atual", body: data?.hpi },
          { title: "História médica", body: data?.medical_history },
          { title: "História odontológica", body: data?.dental_history },
          { title: "Hábitos", body: data?.habits },
          { title: "Medicações", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descrição clínica oral", body: data?.oral_description },
        ],
        "Carregue um caso para visualizar a anamnese completa."
      );
      const pathMedia = splitMicroscopicReportMedia(data?.media || [], data);
      renderMicroscopicReports(
        "path_ctx_micro_report",
        data?.id,
        pathMedia.microscopicReports,
        "Nenhum laudo histopatológico (PDF) carregado."
      );
      renderMediaGallery("path_ctx_media", data?.id, pathMedia.otherMedia, "Nenhuma mídia carregada para este caso.");
      renderDetailCards(
        "path_ctx_report",
        [
          { title: "Diagnóstico histopatológico", body: data?.pathology_diagnosis },
          { title: "Laudo enviado", body: data?.pathology_report },
        ],
        "Nenhum laudo enviado ainda."
      );

      if (!data) return;
      $("path_case_id").value = data.id || $("path_case_id").value;
      if (data.pathology_diagnosis) $("path_diagnosis").value = data.pathology_diagnosis;
      if (data.pathology_report) $("path_report").value = data.pathology_report;
    }

    function getFilesFromFields(fieldIds) {
      return fieldIds
        .map((fieldId) => $(fieldId)?.files?.[0] || null)
        .filter(Boolean);
    }

    function getCheckedValues(fieldName) {
      return Array.from(document.querySelectorAll(`input[name="${fieldName}"]:checked`))
        .map((input) => input.value)
        .filter(Boolean);
    }

    async function uploadMediaBatch(caseId, mediaType, files) {
      const formData = new FormData();
      formData.append("media_type", mediaType);
      files.forEach((file) => formData.append("files", file));
      return apiFetch("/cases/" + caseId + "/media/batch", {
        method: "POST",
        body: formData
      });
    }

    async function uploadSingleMedia(caseId, mediaType, file) {
      const formData = new FormData();
      formData.append("media_type", mediaType);
      formData.append("file", file);
      return apiFetch("/cases/" + caseId + "/media", {
        method: "POST",
        body: formData
      });
    }

    async function uploadCreateMedia(caseId, mediaTypes, files) {
      if (!files.length) return [];
      if (!mediaTypes.length) throw new Error("Selecione ao menos um tipo de mídia.");

      if (mediaTypes.length === 1) {
        return [await uploadMediaBatch(caseId, mediaTypes[0], files)];
      }

      if (mediaTypes.length !== files.length) {
        throw new Error(
          "Selecione 1 tipo para todos os arquivos ou a mesma quantidade de tipos e mídias."
        );
      }

      return Promise.all(
        files.map((file, index) => uploadSingleMedia(caseId, mediaTypes[index], file))
      );
    }

    async function loadCaseNotifications() {
      try {
        const id = Number($("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const notifications = await apiFetch("/notifications/mine");
        const caseNotifications = notifications.filter((item) => item.case_id === id);
        renderTimeline(
          "case_ctx_notifications",
          caseNotifications.map((item) => ({
            meta: `${item.notification_type} • ${item.is_read ? "lida" : "não lida"}`,
            title: item.title,
            body: item.body,
          })),
          "Nenhuma notificação carregada para este caso."
        );
        showMessage("Avisos do caso atualizados.", "success");
      } catch (error) {
        showMessage(error.message || "Falha ao carregar os avisos do caso.", "error");
        showResult(String(error.message || error));
      }
    }

    function switchTab(mode) {
      $("loginPanel").classList.toggle("hidden", mode !== "login");
      $("registerPanel").classList.toggle("hidden", mode !== "register");
      if ($("tabLogin")) $("tabLogin").className = mode === "login" ? "primary active" : "soft";
      if ($("tabRegister")) $("tabRegister").className = mode === "register" ? "primary active" : "soft";
    }

    function bindEnter(id, handler) {
      const el = $(id);
      if (!el) return;
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          handler();
        }
      });
    }

    let currentAppPage = "session";

    function getDefaultPageForRole(role) {
      return "session";
    }

    function getPageDescription(page) {
      const descriptions = {
        session: "Resumo da sessão autenticada e ações básicas da conta.",
        "dentist-home": "Painel do profissional com abertura de novo caso, acompanhamento e conversa.",
        "tele-home": "Painel do teleconsultor com novos casos, respostas clínicas e comunicação.",
        "pathology-home": "Painel do patologista com acesso aos casos completos e envio de laudos.",
        "reg-home": "Painel do regulador com foco nos casos suspeitos detalhados.",
        "case-create": "Tela de abertura de novo caso clínico pelo profissional solicitante.",
        "case-manage": "Tela de consulta, anexo e submissão dos casos do solicitante.",
        chat: "Tela de conversa entre os envolvidos no caso.",
        notifications: "Tela de notificações e acompanhamento de atualizações.",
        tele: "Tela de trabalho do teleconsultor para responder casos.",
        pathology: "Tela do patologista para revisar casos completos e enviar laudo histopatológico.",
        regulation: "Tela de fila e conclusão da telerregulação."
      };
      return descriptions[page] || "Escolha um módulo para continuar.";
    }

    function getPageMeta(page) {
      const meta = {
        session: {
          title: "Início",
          subtitle: "Resumo rápido da sessão, do perfil e dos próximos passos.",
          context: "Use esta tela como ponto de partida para confirmar perfil, atualizar sessão e navegar para o fluxo principal.",
          icon: "⌂"
        },
        "dentist-home": {
          title: "Painel do profissional",
          subtitle: "Abra um novo caso, acompanhe pacientes e converse com a equipe.",
          context: "Esta área concentra o relato de novos casos, o acompanhamento dos pacientes enviados e a conversa do caso.",
          icon: "⌂"
        },
        "tele-home": {
          title: "Painel da teleconsultoria",
          subtitle: "Receba novos casos, responda e acompanhe a conversa clínica.",
          context: "O teleconsultor pode assumir o próximo caso, revisar casos atribuídos e registrar a resposta técnica.",
          icon: "◎"
        },
        "pathology-home": {
          title: "Painel da patologia",
          subtitle: "Acesse casos completos e envie laudos histopatológicos.",
          context: "O patologista consulta os casos pelo nome do paciente, revisa o material clínico e envia o laudo para o profissional e para o teleconsultor.",
          icon: "◉"
        },
        "reg-home": {
          title: "Painel da regulação",
          subtitle: "Acesse os casos suspeitos detalhados e conduza a fila regulatória.",
          context: "O regulador trabalha sobre os casos suspeitos, abrindo o detalhe clínico e registrando o desfecho regulatório.",
          icon: "↗"
        },
        "case-create": {
          title: "Relatar caso",
          subtitle: "Abertura estruturada de novo caso clínico.",
          context: "Preencha os dados do paciente, a história clínica e os achados principais para iniciar a teleinterconsulta.",
          icon: "+"
        },
        "case-manage": {
          title: "Meus casos",
          subtitle: "Consulta, anexos e submissão dos casos em andamento.",
          context: "Depois de criar o caso, use esta tela para revisar o ID, anexar arquivos e enviar o caso para a fila clínica.",
          icon: "◫"
        },
        chat: {
          title: "Conversa do caso",
          subtitle: "Comunicação direta entre os envolvidos no caso.",
          context: "Use a conversa para complementar informações, solicitar esclarecimentos e manter o acompanhamento registrado.",
          icon: "✉"
        },
        notifications: {
          title: "Notificações",
          subtitle: "Avisos de resposta, mensagem nova e regulação.",
          context: "Aqui ficam as atualizações mais recentes do caso para acompanhamento do profissional e da equipe assistencial.",
          icon: "!"
        },
        tele: {
          title: "Teleconsultoria",
          subtitle: "Fila e resposta clínica do especialista.",
          context: "O teleconsultor usa esta tela para assumir casos, responder e sinalizar suspeitas que demandem regulação.",
          icon: "◎"
        },
        pathology: {
          title: "Patologia",
          subtitle: "Laudo histopatológico por caso.",
          context: "O patologista revisa o caso completo, acessa as mídias e envia o laudo histopatológico para o profissional e para o teleconsultor.",
          icon: "◉"
        },
        regulation: {
          title: "Telerregulação",
          subtitle: "Fila de casos suspeitos e encaminhamento regulatório.",
          context: "O regulador acompanha casos suspeitos, assume a análise e registra o desfecho regulatório do atendimento.",
          icon: "↗"
        }
      };
      return meta[page] || meta.session;
    }

    function setDockFlowPage() {
      const role = getCurrentRole();
      if (role === "REGULATOR") {
        setAppPage("regulation");
        return;
      }
      if (role === "PATHOLOGIST") {
        setAppPage("pathology");
        return;
      }
      if (role === "DENTIST" || role === "ADMIN") {
        setAppPage("case-manage");
        return;
      }
      setAppPage("tele");
    }

    function updateDockForRole(role) {
      const dockHome = $("dockHome");
      if (!dockHome) return;
      const homePage = getDefaultPageForRole(role);
      dockHome.dataset.page = homePage;
      const label = dockHome.querySelector("span:last-child");
      if (label) label.textContent = role === "REGULATOR" ? "Suspeitos" : role === "PATHOLOGIST" ? "Patologia" : "Painel";
    }

    function updateWorkspaceHeading(role, page) {
      const byRole = {
        DENTIST: {
          title: "Painel do profissional",
          subtitle: "Nova página de trabalho com relato de caso, acompanhamento e conversa."
        },
        ADMIN: {
          title: "Painel administrativo",
          subtitle: "Acesso ampliado aos módulos do fluxo clínico."
        },
        TELECONSULTANT: {
          title: "Painel da teleconsultoria",
          subtitle: "Nova página de trabalho com novos casos, resposta e conversa."
        },
        PATHOLOGIST: {
          title: "Painel da patologia",
          subtitle: "Nova página com casos completos, laudo histopatológico e conversa."
        },
        REGULATOR: {
          title: "Painel da regulação",
          subtitle: "Nova página com os casos suspeitos detalhados."
        }
      };
      const heading = byRole[role] || byRole.DENTIST;
      if ($("workspaceTitle")) $("workspaceTitle").textContent = heading.title;
      if ($("workspaceSubtitle")) $("workspaceSubtitle").textContent = heading.subtitle;
    }

    function openWorkspace() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        return;
      }
      if ($("publicHome")) $("publicHome").classList.add("hidden");
      if ($("postLogin")) {
        $("postLogin").classList.add("show");
        document.getElementById("postLogin").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setAppPage(getDefaultPageForRole(me));
    }

    function updateShellVisibility(me) {
      if ($("publicHome")) $("publicHome").classList.toggle("hidden", Boolean(me));
      if ($("postLogin")) $("postLogin").classList.toggle("show", Boolean(me));
      if ($("appbarWorkspaceBtn")) $("appbarWorkspaceBtn").classList.toggle("hidden", !me);
      if (me) {
        openWorkspace();
      }
    }

    function setAppPage(page) {
      currentAppPage = page;
      const role = getCurrentRole();
      const meta = getPageMeta(page);

      document.querySelectorAll(".screen-btn[data-page]").forEach((button) => {
        const allowed = (button.dataset.roles || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const visible = !role || allowed.includes(role);
        button.classList.toggle("hidden", !visible);
        button.classList.toggle("active", visible && button.dataset.page === page);
      });

      document.querySelectorAll(".dock-btn[data-page]").forEach((button) => {
        const allowed = (button.dataset.roles || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const visible = !role || allowed.includes(role);
        const isFlowButton = button.id === "dockFlow";
        const isHomeButton = button.id === "dockHome";
        const active = isFlowButton
          ? visible && ((role === "REGULATOR" && page === "regulation") || (role !== "REGULATOR" && page === "tele"))
          : isHomeButton
            ? visible && button.dataset.page === page
            : visible && button.dataset.page === page;
        button.classList.toggle("hidden", !visible);
        button.classList.toggle("active", active);
      });

      document.querySelectorAll(".module-card[data-page]").forEach((module) => {
        const allowed = (module.dataset.roles || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const samePage = module.dataset.page === page;
        const visible = samePage && (!role || allowed.includes(role));
        module.classList.toggle("hidden", !visible);
      });

      if ($("screenLabel")) $("screenLabel").textContent = getPageDescription(page);
      if ($("screenIcon")) $("screenIcon").textContent = meta.icon;
      if ($("screenTitle")) $("screenTitle").textContent = meta.title;
      if ($("screenSubtitle")) $("screenSubtitle").textContent = meta.subtitle;
      if ($("screenContext")) $("screenContext").textContent = meta.context;
      if ($("screenMetaPage")) $("screenMetaPage").textContent = meta.title;
      updateWorkspaceHeading(role, page);

      if (role && page === "pathology" && (role === "PATHOLOGIST" || role === "ADMIN")) {
        loadPathologistCases(false);
      }
    }

    function goToAuth() {
      const me = getCurrentRole();
      if (me) {
        openWorkspace();
      } else {
        if ($("publicHome")) {
          document.getElementById("publicHome").scrollIntoView({ behavior: "smooth", block: "start" });
        }
        switchTab("login");
      }
    }

    function openPublicDashboard() {
      if ($("publicHome")) $("publicHome").classList.remove("hidden");
      if (currentUser) {
        if ($("postLogin")) $("postLogin").classList.remove("show");
      }
      if ($("publicDashboard")) {
        document.getElementById("publicDashboard").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      loadDashboard(false);
    }

    function goToCases() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça acesso para entrar nos módulos de casos.", "error");
        return;
      }
      openWorkspace();
      setAppPage(me === "DENTIST" || me === "ADMIN" ? "case-manage" : getDefaultPageForRole(me));
    }

    function goToTele() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça acesso para entrar na teleconsultoria.", "error");
        return;
      }
      openWorkspace();
      if (me === "REGULATOR") {
        setAppPage("regulation");
        return;
      }
      if (me === "PATHOLOGIST") {
        setAppPage("pathology");
        return;
      }
      setAppPage(me === "DENTIST" || me === "ADMIN" ? "case-manage" : "tele");
    }

    function goToChat() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça acesso para entrar na conversa do caso.", "error");
        return;
      }
      openWorkspace();
      setAppPage("chat");
    }

    function goToNotifications() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça acesso para entrar nas notificações.", "error");
        return;
      }
      openWorkspace();
      setAppPage("notifications");
    }

    function goToRegulation() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça acesso para entrar na regulação.", "error");
        return;
      }
      openWorkspace();
      setAppPage("regulation");
    }

    function updateSession(me) {
      currentUser = me || null;
      $("sessionState").textContent = me ? "Sessão ativa" : "Aguardando acesso";
      $("meEmail").textContent = me?.email || "-";
      $("meRole").textContent = getRoleLabel(me?.role);
      updateDockForRole(me?.role || null);
      updateShellVisibility(me);
      applyRoleVisibility(me?.role || null);
      if (me?.role) {
        setAppPage(getDefaultPageForRole(me.role));
      } else {
        setAppPage("session");
      }
    }

    function applyRoleVisibility(role) {
      const navButtons = document.querySelectorAll(".screen-btn[data-roles]");
      navButtons.forEach((button) => {
        const allowed = (button.dataset.roles || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        button.classList.toggle("hidden", Boolean(role) && !allowed.includes(role));
      });

      const guide = $("roleGuide");
      if (!role) {
        guide.textContent = "";
        guide.classList.add("hidden");
        return;
      }

      const guideByRole = {
        DENTIST: "Fluxo sugerido: relatar caso, anexar arquivos, submeter, acompanhar notificações e conversar pelo módulo de conversa.",
        TELECONSULTANT: "Fluxo sugerido: pegar o próximo caso, revisar detalhes, responder a teleconsultoria e acompanhar o módulo de conversa.",
        PATHOLOGIST: "Fluxo sugerido: abrir casos pelo nome do paciente, revisar o caso completo, enviar o laudo histopatológico e acompanhar o módulo de conversa.",
        REGULATOR: "Fluxo sugerido: consultar a fila regulatória, assumir casos suspeitos e concluir a telerregulação.",
        ADMIN: "Fluxo ampliado: acesso técnico aos módulos principais para suporte e auditoria do fluxo."
      };

      guide.textContent = guideByRole[role] || "Fluxo carregado conforme o perfil autenticado.";
      guide.classList.remove("hidden");
      setAppPage(currentAppPage && document.querySelector('.screen-btn[data-page="' + currentAppPage + '"]:not(.hidden)') ? currentAppPage : getDefaultPageForRole(role));
    }

    function formatCaseOption(caseItem) {
      const patient = caseItem.patient_name || "Paciente sem nome";
      const statusMap = {
        draft: "Rascunho",
        submitted: "Submetido",
        assigned: "Em revisão",
        answered: "Respondido",
        closed: "Fechado"
      };
      const status = statusMap[caseItem.status] || caseItem.status || "sem status";
      return `${patient} • ${status}`;
    }

    function populateCaseSelect(selectId, cases, emptyLabel) {
      const select = $(selectId);
      if (!select) return;
      const previous = select.value;
      const options = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
      (cases || []).forEach((caseItem) => {
        options.push(`<option value="${escapeHtml(caseItem.id)}">${escapeHtml(formatCaseOption(caseItem))}</option>`);
      });
      select.innerHTML = options.join("");
      if ((cases || []).some((caseItem) => String(caseItem.id) === String(previous))) {
        select.value = previous;
      }
    }

    function formatNotificationOption(notification) {
      const patient = notification?.patient_name || (notification?.case_id ? `Caso #${notification.case_id}` : "Sem caso");
      const status = notification?.is_read ? "lida" : "não lida";
      const date = formatDateTime(notification?.created_at);
      return `${patient} • ${status} • ${date}`;
    }

    function populateNotificationSelect(notifications) {
      const select = $("notification_select");
      if (!select) return;
      const previous = select.value;
      const options = [`<option value="">Selecione um paciente</option>`];
      (notifications || []).forEach((item) => {
        options.push(`<option value="${escapeHtml(item.id)}">${escapeHtml(formatNotificationOption(item))}</option>`);
      });
      select.innerHTML = options.join("");
      if ((notifications || []).some((item) => String(item.id) === String(previous))) {
        select.value = previous;
      }
    }

    function setCaseSelection(id) {
      if (!id) return;
      $("case_lookup_id").value = id;
      $("chat_case_id").value = id;
      $("tele_case_id").value = id;
      $("reg_case_id").value = id;
      $("path_case_id").value = id;
      ["case_lookup_select", "chat_case_select", "tele_case_select", "reg_case_select"].forEach((selectId) => {
        const select = $(selectId);
        if (select && Array.from(select.options).some((option) => option.value === String(id))) {
          select.value = String(id);
        }
      });
      const pathSelect = $("path_case_select");
      if (pathSelect && Array.from(pathSelect.options).some((option) => option.value === String(id))) {
        pathSelect.value = String(id);
      }
    }

    function syncCaseSelection(kind) {
      const byKind = {
        case: "case_lookup_select",
        chat: "chat_case_select",
        tele: "tele_case_select",
        reg: "reg_case_select",
        path: "path_case_select"
      };
      const select = $(byKind[kind]);
      if (!select || !select.value) return;
      setCaseSelection(Number(select.value));
    }

    function onCaseSelectAndLoad(kind) {
      syncCaseSelection(kind);
      if (kind === "tele") {
        loadTeleCaseContext();
        return;
      }
      if (kind === "path") {
        loadPathologyCaseContext();
        return;
      }
      if (kind === "reg") {
        loadRegulationCaseContext();
      }
    }

    function doLogout() {
      localStorage.removeItem(TOKEN_KEY);
      updateSession(null);
      showMessage("Sessão encerrada.", "success");
      showResult("Sessão encerrada. Faça acesso novamente para continuar.");
      switchTab("login");
    }

    async function apiFetch(path, options = {}) {
      const headers = new Headers(options.headers || {});
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) headers.set("Authorization", "Bearer " + token);

      const response = await fetch(window.location.origin + path, {
        ...options,
        headers
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!response.ok) {
        const detail = data && data.detail;
        const message = Array.isArray(detail)
          ? detail.join("; ")
          : (typeof detail === "string" ? detail : (text || response.statusText));
        throw new Error(message);
      }

      return data;
    }

    async function loadSession() {
      try {
        const me = await apiFetch("/auth/me");
        updateSession(me);
        showMessage("Sessão atualizada com sucesso.", "success");
        showResult(me);
      } catch (error) {
        updateSession(null);
        showMessage(error.message || "Falha ao carregar a sessão.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadDashboard(showFeedback = true) {
      try {
        const [summary, openClosed, byState] = await Promise.all([
          apiFetch("/dashboard/summary"),
          apiFetch("/dashboard/cases-open-vs-closed"),
          apiFetch("/dashboard/cases-by-state"),
        ]);

        setText("dash_since", summary?.since ? formatDateTime(summary.since) : "-");
        setText("dash_total", summary?.total ?? 0);
        setText("dash_suspected", summary?.suspected_cases ?? 0);
        setText("dash_avg_age", summary?.avg_patient_age == null ? "-" : Number(summary.avg_patient_age).toFixed(1));
        setText("dash_professionals_total", summary?.professionals_total ?? 0);
        setText("dash_teleconsultants_total", summary?.teleconsultants_total ?? 0);

        const byRole = summary?.professionals_by_role || {};
        setText("dash_role_dentist", byRole.DENTIST ?? 0);
        setText("dash_role_pathologist", byRole.PATHOLOGIST ?? 0);
        setText("dash_role_regulator", byRole.REGULATOR ?? 0);

        const bySex = summary?.by_sex || {};
        const sexLine = [
          `F: ${bySex.F ?? 0}`,
          `M: ${bySex.M ?? 0}`,
          `Outros: ${Object.entries(bySex)
            .filter(([k]) => k !== "F" && k !== "M")
            .reduce((acc, [, v]) => acc + Number(v || 0), 0)}`,
        ].join(" | ");
        setText("dash_by_sex", sexLine);

        const byStateRows = (byState || []).slice(0, 10).map((item) => ({
          label: item?.state || "-",
          value: Number(item?.count || 0),
        }));
        renderMiniChart("dash_by_state_chart", byStateRows, "Sem dados de estado no período selecionado.");

        if (showFeedback) showMessage("Painel atualizado com sucesso.", "success");
        showResult({ summary, openClosed, byState });
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o painel.", "error");
        showResult(String(error.message || error));
      }
    }

    function startDashboardAutoRefresh() {
      if (dashboardAutoRefreshTimer) clearInterval(dashboardAutoRefreshTimer);
      dashboardAutoRefreshTimer = setInterval(() => {
        if (document.hidden) return;
        loadDashboard(false);
      }, 30000);
    }

    function buildCasePayload() {
      return {
        dentist_state: $("case_dentist_state").value.trim().toUpperCase(),
        dentist_municipality: $("case_dentist_municipality").value.trim(),
        unit_name: $("case_unit_name").value.trim(),
        patient_name: $("case_patient_name").value.trim(),
        sus_card: $("case_sus_card").value.trim(),
        patient_phone: $("case_patient_phone").value.trim(),
        patient_sex: $("case_patient_sex").value,
        patient_age: $("case_patient_age").value ? Number($("case_patient_age").value) : null,
        patient_city: $("case_patient_city").value.trim(),
        patient_state: $("case_patient_state").value.trim().toUpperCase(),
        chief_complaint: $("case_chief_complaint").value.trim(),
        hpi: $("case_hpi").value.trim(),
        medical_history: $("case_medical_history").value.trim(),
        dental_history: $("case_dental_history").value.trim(),
        habits: $("case_habits").value.trim(),
        meds_history: $("case_meds_history").value.trim(),
        vitals: $("case_vitals").value.trim(),
        oral_description: $("case_oral_description").value.trim(),
        dentist_hypotheses: $("case_dentist_hypotheses").value.trim(),
        lesion_topography: $("case_lesion_topography").value.trim(),
        is_biopsied: $("case_is_biopsied").value === "true"
      };
    }

    function validateCasePayload(payload) {
      const required = [
        ["dentist_state", "UF do serviço"],
        ["dentist_municipality", "Município do serviço"],
        ["unit_name", "Unidade / serviço"],
        ["patient_name", "Paciente"],
        ["sus_card", "Cartão SUS"],
        ["patient_phone", "Telefone do paciente"],
        ["patient_sex", "Sexo"],
        ["patient_city", "Município do paciente"],
        ["patient_state", "UF do paciente"],
        ["chief_complaint", "Queixa principal"],
        ["hpi", "História da doença atual"],
        ["medical_history", "História médica"],
        ["dental_history", "História odontológica"],
        ["habits", "Hábitos"],
        ["meds_history", "Medicações"],
        ["vitals", "Sinais vitais e achados gerais"],
        ["oral_description", "Descrição clínica oral"],
        ["dentist_hypotheses", "Hipóteses diagnósticas"],
        ["lesion_topography", "Topografia da lesão"]
      ];

      for (const [key, label] of required) {
        if (!payload[key]) throw new Error("Preencha o campo: " + label + ".");
      }

      if (!Number.isInteger(payload.patient_age) || payload.patient_age <= 0) {
        throw new Error("Informe uma idade válida.");
      }

      if (payload.dentist_state.length !== 2 || payload.patient_state.length !== 2) {
        throw new Error("As UFs devem conter duas letras.");
      }
    }

    async function createCase(shouldSubmit = false) {
      try {
        const files = getFilesFromFields([
          "case_create_media_file_1",
          "case_create_media_file_2",
          "case_create_media_file_3",
          "case_create_media_file_4"
        ]);
        if (shouldSubmit && !files.length) {
          throw new Error("Anexe ao menos uma mídia antes de criar e submeter o caso.");
        }

        const payload = buildCasePayload();
        validateCasePayload(payload);
        const created = await apiFetch("/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const selectedMediaTypes = getCheckedValues("case_create_media_type");
        if (created && created.id) {
          setCaseSelection(created.id);
        }
        if (created?.id && files.length) {
          await uploadCreateMedia(created.id, selectedMediaTypes, files);
          ["case_create_media_file_1", "case_create_media_file_2", "case_create_media_file_3", "case_create_media_file_4"].forEach((fieldId) => {
            if ($(fieldId)) $(fieldId).value = "";
          });
        }
        let finalCase = created;
        if (created?.id && shouldSubmit) {
          finalCase = await apiFetch("/cases/" + created.id + "/submit", {
            method: "POST"
          });
          setCaseSelection(finalCase.id);
        }
        await loadMyCases(false);
        showMessage(
          shouldSubmit
            ? (files.length ? "Caso criado, mídias anexadas e submetido com sucesso." : "Caso criado e submetido com sucesso.")
            : (files.length ? "Caso criado e mídias anexadas com sucesso." : "Caso criado com sucesso."),
          "success"
        );
        showResult(finalCase);
      } catch (error) {
        showMessage(error.message || "Falha ao criar caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadMyCases(showFeedback = true) {
      try {
        const cases = await apiFetch("/cases/mine");
        populateCaseSelect("case_lookup_select", cases, "Selecione um caso");
        populateCaseSelect("chat_case_select", cases, "Selecione um caso");
        if (showFeedback) showMessage("Lista de casos atualizada.", "success");
        showResult(cases);
        return cases;
      } catch (error) {
        showMessage(error.message || "Falha ao carregar casos.", "error");
        showResult(String(error.message || error));
        return [];
      }
    }

    async function loadCaseById() {
      try {
        const id = Number($("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const caseData = await apiFetch("/cases/" + id);
        setCaseSelection(id);
        $("chat_case_id").value = id;
        fillCaseDetailContext(caseData);
        fillCaseFormForEdit(caseData);
        await loadCaseNotifications();
        showMessage("Caso carregado com sucesso.", "success");
        showResult(caseData);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function updateCase() {
      try {
        const id = Number($("case_lookup_id").value || $("case_lookup_select").value);
        if (!id) throw new Error("Abra um caso na tela 'Meus casos' para editar.");

        const payload = buildCasePayload();
        validateCasePayload(payload);

        const updated = await apiFetch("/cases/" + id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        setCaseSelection(id);
        fillCaseDetailContext(updated);
        fillCaseFormForEdit(updated);
        await loadMyCases(false);
        showMessage("Caso atualizado com sucesso.", "success");
        showResult(updated);
      } catch (error) {
        showMessage(error.message || "Falha ao atualizar o caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadCaseMessages() {
      try {
        const id = Number($("chat_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido para a conversa.");
        $("chat_case_id").value = id;
        const messages = await apiFetch("/cases/" + id + "/messages");
        renderChatMessages(messages);
        showMessage("Conversa atualizada com sucesso.", "success");
        showResult(messages);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar a conversa.", "error");
        showResult(String(error.message || error));
      }
    }

    async function sendCaseMessage() {
      try {
        const id = Number($("chat_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido para a conversa.");
        const message = $("chat_message").value.trim();
        if (message.length < 2) throw new Error("Escreva uma mensagem com pelo menos 2 caracteres.");
        $("chat_case_id").value = id;
        const created = await apiFetch("/cases/" + id + "/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message })
        });
        $("chat_message").value = "";
        await loadCaseMessages();
        showMessage("Ação bem-sucedida: mensagem enviada com sucesso.", "success");
        showResult(created);
      } catch (error) {
        showMessage(error.message || "Falha ao enviar a mensagem.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadNotifications(showFeedback = true) {
      try {
        const notifications = await apiFetch("/notifications/mine");
        notificationsCache = notifications;
        populateNotificationSelect(notifications);
        renderTimeline(
          "case_ctx_notifications",
          notifications.slice(0, 5).map((item) => ({
            meta: `${item.notification_type} • ${item.is_read ? "lida" : "não lida"}`,
            title: item.title,
            body: item.body,
          })),
          "Nenhuma notificação encontrada."
        );
        if (showFeedback) showMessage("Notificações atualizadas.", "success");
        showResult(notifications);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar notificações.", "error");
        showResult(String(error.message || error));
      }
    }

    async function markNotificationRead() {
      try {
        const id = Number($("notification_select").value);
        if (!id) throw new Error("Selecione uma notificação pelo nome do paciente.");
        const updated = await apiFetch("/notifications/" + id + "/read", {
          method: "POST"
        });
        notificationsCache = notificationsCache.map((item) => (item.id === id ? { ...item, ...updated } : item));
        populateNotificationSelect(notificationsCache);
        await loadNotifications(false);
        showMessage("Notificação marcada como lida.", "success");
        showResult(updated);
      } catch (error) {
        showMessage(error.message || "Falha ao atualizar a notificação.", "error");
        showResult(String(error.message || error));
      }
    }

    function buildTeleAnswerPayload() {
      const malignantValue = $("tele_malignant").value;
      return {
        clinical_description: $("tele_summary").value.trim(),
        justified_hypotheses: $("tele_hypotheses").value.trim(),
        clinical_conduct: $("tele_conduct").value.trim(),
        care_coordination: $("tele_care").value.trim(),
        bibliography: $("tele_bibliography").value.trim() || null,
        consultant_hypothesis: $("tele_hypothesis").value.trim() || null,
        consultant_is_malignant: malignantValue === "" ? null : malignantValue === "true"
      };
    }

    function validateTeleAnswerPayload(payload) {
      const required = [
        ["clinical_description", "Descrição clínica / síntese do caso"],
        ["justified_hypotheses", "Hipóteses diagnósticas justificadas"],
        ["clinical_conduct", "Conduta clínica"],
        ["care_coordination", "Coordenação do cuidado"]
      ];

      for (const [key, label] of required) {
        if (!payload[key] || payload[key].length < 3) {
          throw new Error("Preencha o campo: " + label + ".");
        }
      }
    }

    async function teleNext() {
      try {
        const data = await apiFetch("/teleconsultor/next", { method: "POST" });
        if (data && data.id) {
          setCaseSelection(data.id);
          fillTeleCaseContext(data);
          fillRegulationCaseContext(data);
          await teleMyCases(false);
        }
        showMessage(data ? "Caso atribuído com sucesso." : "Nenhum caso disponível na fila.", "success");
        showResult(data || "Nenhum caso disponível.");
      } catch (error) {
        showMessage(error.message || "Falha ao buscar o próximo caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function teleMyCases(showFeedback = true) {
      try {
        const data = await apiFetch("/teleconsultor/my-cases");
        populateCaseSelect("tele_case_select", data, "Selecione um caso");
        populateCaseSelect("chat_case_select", data, "Selecione um caso");
        if (showFeedback) showMessage("Casos atribuídos atualizados.", "success");
        showResult(data);
        return data;
      } catch (error) {
        showMessage(error.message || "Falha ao carregar casos atribuídos.", "error");
        showResult(String(error.message || error));
        return [];
      }
    }

    async function loadTeleCaseContext() {
      try {
        const id = Number($("tele_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const data = await apiFetch("/cases/" + id);
        fillTeleCaseContext(data);
        setCaseSelection(id);
        showMessage("Caso carregado para teleconsultoria.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o caso da teleconsultoria.", "error");
        showResult(String(error.message || error));
      }
    }

    async function teleAnswerCase() {
      try {
        const id = Number($("tele_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const payload = buildTeleAnswerPayload();
        validateTeleAnswerPayload(payload);
        const data = await apiFetch("/teleconsultor/cases/" + id + "/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setCaseSelection(id);
        showMessage("Ação bem-sucedida: resposta da teleconsultoria enviada com sucesso.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao enviar a resposta da teleconsultoria.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadPathologistCases(showFeedback = true) {
      try {
        const data = await apiFetch("/pathologist/cases");
        populateCaseSelect("path_case_select", data, "Selecione um caso");
        populateCaseSelect("chat_case_select", data, "Selecione um caso");
        if (showFeedback) showMessage("Casos do patologista atualizados.", "success");
        showResult(data);
        return data;
      } catch (error) {
        showMessage(error.message || "Falha ao carregar casos para patologia.", "error");
        showResult(String(error.message || error));
        return [];
      }
    }

    async function loadPathologyCaseContext() {
      try {
        const id = Number($("path_case_select").value || $("path_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const data = await apiFetch("/pathologist/cases/" + id);
        fillPathologyCaseContext(data);
        setCaseSelection(id);
        showMessage("Caso carregado para patologia.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o caso da patologia.", "error");
        showResult(String(error.message || error));
      }
    }

    async function submitPathologyReport(isEdit = false) {
      try {
        const id = Number($("path_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const diagnosisInput = $("path_diagnosis").value.trim();
        const report = $("path_report").value.trim();
        const fileInput = $("path_report_file");
        const file = fileInput?.files?.[0] || null;

        if (report && report.length < 3) throw new Error("Informe o laudo histopatológico com pelo menos 3 caracteres.");
        if (diagnosisInput && diagnosisInput.length < 3) throw new Error("Informe o diagnóstico com pelo menos 3 caracteres.");
        if (isEdit) {
          if (!diagnosisInput && !report && !file) throw new Error("Informe ao menos diagnóstico, laudo ou arquivo para editar.");
        } else if (!report && !file) {
          throw new Error("Informe o laudo escrito ou selecione um arquivo para envio.");
        }

        let data = null;
        let sentReport = false;
        let sentFile = false;

        if (isEdit) {
          const payload = {};
          if (diagnosisInput) payload.diagnosis = diagnosisInput;
          if (report) payload.report = report;
          if (Object.keys(payload).length) {
            data = await apiFetch("/pathologist/cases/" + id + "/report", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            sentReport = true;
          }
        } else if (report) {
          const diagnosis = diagnosisInput.length >= 3 ? diagnosisInput : report;
          data = await apiFetch("/pathologist/cases/" + id + "/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diagnosis, report })
          });
          sentReport = true;
        }

        if (file) {
          await uploadSingleMedia(id, "exam", file);
          sentFile = true;
          if (fileInput) fileInput.value = "";
        }

        if (!data || sentFile) {
          data = await apiFetch("/pathologist/cases/" + id);
        }

        setCaseSelection(id);
        fillPathologyCaseContext(data);
        if (isEdit && sentReport && sentFile) {
          showMessage("Laudo e arquivo atualizados com sucesso.", "success");
        } else if (isEdit && sentReport) {
          showMessage("Laudo atualizado com sucesso.", "success");
        } else if (isEdit && sentFile) {
          showMessage("Arquivo do laudo atualizado com sucesso.", "success");
        } else if (sentReport && sentFile) {
          showMessage("Laudo textual e arquivo enviados com sucesso.", "success");
        } else if (sentFile) {
          showMessage("Arquivo do laudo enviado com sucesso.", "success");
        } else {
          showMessage("Laudo histopatológico enviado com sucesso.", "success");
        }
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao enviar o laudo histopatológico.", "error");
        showResult(String(error.message || error));
      }
    }

    async function updatePathologyReport() {
      return submitPathologyReport(true);
    }

    async function loadRegulationQueue(showFeedback = true) {
      try {
        const data = await apiFetch("/regulator/queue");
        populateCaseSelect("reg_case_select", data, "Selecione um caso suspeito");
        populateCaseSelect("chat_case_select", data, "Selecione um caso");
        if (showFeedback) showMessage("Fila regulatória atualizada.", "success");
        showResult(data);
        return data;
      } catch (error) {
        showMessage(error.message || "Falha ao carregar a fila regulatória.", "error");
        showResult(String(error.message || error));
        return [];
      }
    }

    async function loadRegulationCaseContext() {
      try {
        const id = Number($("reg_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const data = await apiFetch("/cases/" + id);
        fillRegulationCaseContext(data);
        setCaseSelection(id);
        showMessage("Caso carregado para telerregulação.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o caso regulatório.", "error");
        showResult(String(error.message || error));
      }
    }

    async function takeRegulationCase() {
      try {
        const id = Number($("reg_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const data = await apiFetch("/regulator/cases/" + id + "/take", {
          method: "POST"
        });
        setCaseSelection(id);
        fillRegulationCaseContext(data);
        await loadRegulationQueue(false);
        showMessage("Caso assumido para telerregulação.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao assumir o caso regulatório.", "error");
        showResult(String(error.message || error));
      }
    }

    async function submitRegulationUpdate(finalize = false) {
      try {
        const id = Number($("reg_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const notes = $("reg_notes").value.trim();
        if (notes.length < 3) throw new Error("Preencha as notas regulatórias.");
        const regulationStatus = finalize ? "completed" : "in_review";
        const microscopicReportDate = $("reg_microscopic_report_date").value || null;
        const followup1m = $("reg_followup_1m").value;
        const followup3m = $("reg_followup_3m").value;
        const followup6mStatus = $("reg_followup_6m_status").value.trim();
        const followup1yStatus = $("reg_followup_1y_status").value.trim();
        const followupBarriers = $("reg_followup_barriers").value.trim();

        if (finalize) {
          if (!microscopicReportDate) throw new Error("Informe a data do laudo histopatológico.");
          if (followup1m === "") throw new Error("Informe o acompanhamento de 1 mês.");
          if (followup3m === "") throw new Error("Informe o acompanhamento de 3 meses.");
          if (followup6mStatus.length < 3) throw new Error("Descreva o acompanhamento de 6 meses.");
          if (followup1yStatus.length < 3) throw new Error("Descreva o acompanhamento de 1 ano.");
          if (followupBarriers.length < 3) throw new Error("Descreva as principais barreiras.");
        }

        const data = await apiFetch("/regulator/cases/" + id + "/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regulation_notes: notes,
            regulation_status: regulationStatus,
            microscopic_report_date: microscopicReportDate,
            followup_1m_head_neck_seen: followup1m === "" ? null : followup1m === "true",
            followup_3m_initial_treatment_done: followup3m === "" ? null : followup3m === "true",
            followup_6m_status: followup6mStatus || null,
            followup_1y_status: followup1yStatus || null,
            followup_main_barriers: followupBarriers || null,
          })
        });
        setCaseSelection(id);
        fillRegulationCaseContext(data);
        showMessage(
          finalize
            ? "Ação bem-sucedida: telerregulação concluída com sucesso."
            : "Ação bem-sucedida: atualização da regulação salva (em análise).",
          "success"
        );
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao salvar a regulação.", "error");
        showResult(String(error.message || error));
      }
    }

    async function saveRegulationProgress() {
      return submitRegulationUpdate(false);
    }

    async function completeRegulation() {
      return submitRegulationUpdate(true);
    }

    async function doRegister() {
      try {
        const full_name = $("register_name").value.trim();
        const email = $("register_email").value.trim();
        const password = $("register_password").value;
        const phone = $("register_phone").value.trim();
        const age = $("register_age").value ? Number($("register_age").value) : null;
        const sex = $("register_sex").value;
        const address = $("register_address").value.trim();
        const municipality = $("register_municipality").value.trim();
        const state = $("register_state").value.trim().toUpperCase();
        const council_number = $("register_council_number").value.trim();
        const profession = $("register_profession").value.trim();
        const unit_name = $("register_unit_name").value.trim();
        const has_specialization = $("register_has_specialization").value === "true";
        const specialization = $("register_specialization").value.trim();
        const role = $("register_role").value;

        if (full_name.length < 3) throw new Error("Informe o nome completo.");
        if (!email) throw new Error("Informe o e-mail.");
        if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
        if (phone.length < 8) throw new Error("Informe o telefone.");
        if (!Number.isInteger(age) || age < 18) throw new Error("Informe uma idade válida.");
        if (!sex) throw new Error("Selecione o sexo.");
        if (address.length < 5) throw new Error("Informe o endereco.");
        if (municipality.length < 2) throw new Error("Informe o município.");
        if (state.length !== 2) throw new Error("Informe a UF com 2 letras.");
        if (council_number.length < 2) throw new Error("Informe o número no conselho profissional.");
        if (profession.length < 2) throw new Error("Informe a profissão.");
        if (unit_name.length < 2) throw new Error("Informe a unidade de atendimento.");
        if (has_specialization && specialization.length < 2) throw new Error("Informe a especialidade.");
        if (!role) throw new Error("Selecione o perfil de acesso.");

        const data = await apiFetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name,
            email,
            password,
            phone,
            age,
            sex,
            address,
            municipality,
            state,
            council_number,
            profession,
            unit_name,
            has_specialization,
            specialization: specialization || null,
            role
          })
        });

        if (data?.role && data.role !== role) {
          throw new Error(`O backend retornou o perfil ${getRoleLabel(data.role)} em vez de ${getRoleLabel(role)}.`);
        }

        $("login_email").value = email;
        $("login_password").value = password;
        showMessage(`Cadastro realizado como ${getRoleLabel(data?.role || role)}. Agora vou entrar automaticamente.`, "success");
        showResult(data);
        switchTab("login");
        await doLogin();
      } catch (error) {
        showMessage(error.message || "Falha no cadastro.", "error");
        showResult(String(error.message || error));
      }
    }

    async function doLogin() {
      try {
        const email = $("login_email").value.trim();
        const password = $("login_password").value;

        if (!email) throw new Error("Informe o e-mail.");
        if (!password) throw new Error("Informe a senha.");

        const body = new URLSearchParams();
        body.set("grant_type", "password");
        body.set("username", email);
        body.set("password", password);

        const response = await fetch(window.location.origin + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        });

        const loginData = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(loginData.detail || "Falha no acesso.");
        }

        localStorage.setItem(TOKEN_KEY, loginData.access_token);
        const me = await apiFetch("/auth/me");
        showMessage(`Acesso realizado com sucesso como ${getRoleLabel(me.role)}.`, "success");
        showResult({ token: loginData, me });
        updateSession(me);
        if (me.role === "DENTIST" || me.role === "ADMIN") {
          await loadMyCases(false);
        } else if (me.role === "TELECONSULTANT") {
          await teleMyCases(false);
        } else if (me.role === "PATHOLOGIST") {
          await loadPathologistCases(false);
        } else if (me.role === "REGULATOR") {
          await loadRegulationQueue(false);
        }
      } catch (error) {
        showMessage(error.message || "Falha no acesso.", "error");
        showResult(String(error.message || error));
      }
    }

    window.syncCaseSelection = syncCaseSelection;

    bindEnter("login_email", doLogin);
    bindEnter("login_password", doLogin);
    bindEnter("register_name", doRegister);
    bindEnter("register_email", doRegister);
    bindEnter("register_password", doRegister);
    bindEnter("case_lookup_id", loadCaseById);
    bindEnter("chat_case_id", loadCaseMessages);
    bindEnter("chat_message", sendCaseMessage);
    bindEnter("tele_case_id", teleAnswerCase);
    bindEnter("reg_case_id", takeRegulationCase);
    switchTab("login");
    updateSession(null);
    if (localStorage.getItem(TOKEN_KEY)) {
      loadSession();
    } else {
      loadDashboard(false);
    }
    startDashboardAutoRefresh();
