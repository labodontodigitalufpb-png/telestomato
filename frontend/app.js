    const TOKEN_KEY = "teleestomato_debug_token";
    let currentUser = null;
    let activeMediaGallery = [];
    let activeMediaIndex = -1;

    function $(id) {
      return document.getElementById(id);
    }

    function showMessage(message, type) {
      const el = $("message");
      el.textContent = message;
      el.className = "message show " + type;
    }

    function showResult(data) {
      $("result").textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
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
      return `${window.location.origin}/cases/${caseId}/media/${mediaId}/file`;
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
            <p>Abra o arquivo em uma nova aba para visualizar o conteudo completo.</p>
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
                <button class="media-download" type="button" onclick="event.stopPropagation(); downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Download</button>
              </button>
            `;
          }
          if (kind === "video") {
            return `
              <button class="media-card file" type="button" onclick="openMediaLightboxByIndex(${index})">
                <strong>${escapeHtml(getMediaKindLabel(item))}</strong>
                <span>${escapeHtml(label)}</span>
                <small>${escapeHtml(meta)}</small>
                <button class="media-download" type="button" onclick="event.stopPropagation(); downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Download</button>
              </button>
            `;
          }
          return `
            <button class="media-card file" type="button" onclick="openMediaLightboxByIndex(${index})">
              <strong>${escapeHtml(getMediaKindLabel(item))}</strong>
              <span>${escapeHtml(label)}</span>
              <small>${escapeHtml(meta)}</small>
              <button class="media-download" type="button" onclick="event.stopPropagation(); downloadMedia(${caseId}, ${item.id}, ${JSON.stringify(label)})">Download</button>
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
          const authorLabel = isMine ? "Voce" : `Usuario ${item.author_user_id}`;
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
      setText("tele_ctx_status", data?.status);
      setText("tele_ctx_topography", data?.lesion_topography);
      setText("tele_ctx_dentist_hypothesis", data?.dentist_hypotheses);
      setText("tele_ctx_complaint", data?.chief_complaint || "Carregue um caso para visualizar o contexto clinico.");
      setText("tele_ctx_oral", data?.oral_description);
      renderDetailCards(
        "tele_ctx_clinical",
        [
          { title: "Historia da doenca atual", body: data?.hpi },
          { title: "Historia medica", body: data?.medical_history },
          { title: "Historia odontologica", body: data?.dental_history },
          { title: "Habitos", body: data?.habits },
          { title: "Medicacoes", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descricao clinica oral", body: data?.oral_description },
        ],
        "Carregue um caso para visualizar a anamnese completa."
      );
      renderMediaGallery("tele_ctx_media", data?.id, data?.media || [], "Carregue um caso para visualizar as mídias.");
      renderDetailCards(
        "tele_ctx_pathology",
        [
          { title: "Diagnostico histopatologico", body: data?.pathology_diagnosis },
          { title: "Laudo histopatologico", body: data?.pathology_report },
        ],
        "Nenhum laudo histopatológico registrado ainda."
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
      setText("reg_ctx_case_status", data?.status);
      setText("reg_ctx_reg_status", data?.regulation_status);
      setText("reg_ctx_malignant", data?.consultant_is_malignant == null ? "-" : (data.consultant_is_malignant ? "Sim" : "Nao"));
      setText("reg_ctx_hypothesis", data?.consultant_hypothesis || data?.consultant_hypotheses || "Carregue um caso para visualizar a sintese do teleconsultor.");
      setText("reg_ctx_conduct", [data?.consultant_conduct, data?.consultant_care_coordination].filter(Boolean).join(" | "));
      setText("reg_ctx_notes", data?.regulation_notes);
      renderDetailCards(
        "reg_ctx_clinical",
        [
          { title: "Queixa principal", body: data?.chief_complaint },
          { title: "Historia da doenca atual", body: data?.hpi },
          { title: "Historia medica", body: data?.medical_history },
          { title: "Historia odontologica", body: data?.dental_history },
          { title: "Habitos", body: data?.habits },
          { title: "Medicacoes", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descricao clinica oral", body: data?.oral_description },
        ],
        "Carregue um caso para visualizar a anamnese completa."
      );
      renderMediaGallery("reg_ctx_media", data?.id, data?.media || [], "Carregue um caso para visualizar as mídias.");

      if (!data) return;
      $("reg_case_id").value = data.id || $("reg_case_id").value;
      if (data.regulation_status) $("reg_status").value = data.regulation_status;
      if (data.regulation_notes) $("reg_notes").value = data.regulation_notes;
    }

    function fillCaseDetailContext(data) {
      setText("case_ctx_id", data?.id);
      setText("case_ctx_status", data?.status);
      setText("case_ctx_patient", data?.patient_name);
      setText("case_ctx_topography", data?.lesion_topography);
      setText("case_ctx_complaint", data?.chief_complaint || "Abra um caso para acompanhar a resposta da teleconsultoria.");
      renderDetailCards(
        "case_ctx_clinical",
        [
          { title: "Historia da doenca atual", body: data?.hpi },
          { title: "Historia medica", body: data?.medical_history },
          { title: "Historia odontologica", body: data?.dental_history },
          { title: "Habitos", body: data?.habits },
          { title: "Medicacoes", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descricao clinica oral", body: data?.oral_description },
          { title: "Hipoteses do solicitante", body: data?.dentist_hypotheses },
        ],
        "Abra um caso para visualizar a anamnese completa."
      );
      renderMediaGallery("case_ctx_media", data?.id, data?.media || [], "Nenhuma mídia carregada para este caso.");

      renderDetailCards(
        "case_ctx_consultant",
        [
          { title: "Hipotese principal", body: data?.consultant_hypothesis },
          { title: "Sintese clinica", body: data?.consultant_summary },
          { title: "Hipoteses justificadas", body: data?.consultant_hypotheses },
          { title: "Bibliografia", body: data?.consultant_bibliography },
        ],
        "Nenhuma resposta registrada ainda."
      );

      renderDetailCards(
        "case_ctx_conduct",
        [
          { title: "Conduta clinica", body: data?.consultant_conduct },
          { title: "Coordenacao do cuidado", body: data?.consultant_care_coordination },
        ],
        "-"
      );

      renderDetailCards(
        "case_ctx_regulation",
        [
          { title: "Status regulatorio", body: data?.regulation_status },
          {
            title: "Suspeita de malignidade",
            body: data?.consultant_is_malignant == null ? "" : (data.consultant_is_malignant ? "Sim" : "Nao"),
          },
          { title: "Notas regulatorias", body: data?.regulation_notes },
        ],
        "Sem atualizacao regulatoria no momento."
      );

      renderDetailCards(
        "case_ctx_pathology",
        [
          { title: "Diagnostico histopatologico", body: data?.pathology_diagnosis },
          { title: "Laudo histopatologico", body: data?.pathology_report },
        ],
        "Nenhum laudo histopatológico registrado ainda."
      );
    }

    function fillPathologyCaseContext(data) {
      setText("path_ctx_patient", data?.patient_name);
      setText("path_ctx_status", data?.status);
      setText("path_ctx_topography", data?.lesion_topography);
      setText("path_ctx_dentist_hypothesis", data?.dentist_hypotheses);
      setText("path_ctx_complaint", data?.chief_complaint || "Carregue um caso para visualizar o contexto clinico.");
      renderDetailCards(
        "path_ctx_clinical",
        [
          { title: "Historia da doenca atual", body: data?.hpi },
          { title: "Historia medica", body: data?.medical_history },
          { title: "Historia odontologica", body: data?.dental_history },
          { title: "Habitos", body: data?.habits },
          { title: "Medicacoes", body: data?.meds_history },
          { title: "Sinais vitais e achados gerais", body: data?.vitals },
          { title: "Descricao clinica oral", body: data?.oral_description },
        ],
        "Carregue um caso para visualizar a anamnese completa."
      );
      renderMediaGallery("path_ctx_media", data?.id, data?.media || [], "Carregue um caso para visualizar as mídias.");
      renderDetailCards(
        "path_ctx_report",
        [
          { title: "Diagnostico histopatologico", body: data?.pathology_diagnosis },
          { title: "Laudo histopatologico", body: data?.pathology_report },
        ],
        "Nenhum laudo registrado ainda."
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

    async function uploadMediaBatch(caseId, mediaType, files) {
      const formData = new FormData();
      formData.append("media_type", mediaType);
      files.forEach((file) => formData.append("files", file));
      return apiFetch("/cases/" + caseId + "/media/batch", {
        method: "POST",
        body: formData
      });
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
            meta: `${item.notification_type} • ${item.is_read ? "lida" : "nao lida"}`,
            title: item.title,
            body: item.body,
          })),
          "Nenhuma notificacao carregada para este caso."
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
      if (role === "DENTIST" || role === "ADMIN") return "dentist-home";
      if (role === "TELECONSULTANT") return "tele-home";
      if (role === "PATHOLOGIST") return "pathology-home";
      if (role === "REGULATOR") return "reg-home";
      return "session";
    }

    function getPageDescription(page) {
      const descriptions = {
        session: "Resumo da sessao autenticada e acoes basicas da conta.",
        "dentist-home": "Painel do profissional com abertura de novo caso, acompanhamento e chat.",
        "tele-home": "Painel do teleconsultor com novos casos, respostas clinicas e comunicacao.",
        "pathology-home": "Painel do patologista com acesso aos casos completos e envio de laudos.",
        "reg-home": "Painel do regulador com foco nos casos suspeitos detalhados.",
        "case-create": "Tela de abertura de novo caso clinico pelo profissional solicitante.",
        "case-manage": "Tela de consulta, anexo e submissao dos casos do solicitante.",
        chat: "Tela de comunicacao entre os envolvidos no caso.",
        notifications: "Tela de notificacoes e acompanhamento de atualizacoes.",
        tele: "Tela de trabalho do teleconsultor para responder casos.",
        pathology: "Tela do patologista para revisar casos completos e enviar laudo histopatologico.",
        regulation: "Tela de fila e conclusao da telerregulacao."
      };
      return descriptions[page] || "Escolha um modulo para continuar.";
    }

    function getPageMeta(page) {
      const meta = {
        session: {
          title: "Inicio",
          subtitle: "Resumo rapido da sessao, do perfil e dos proximos passos.",
          context: "Use esta tela como ponto de partida para confirmar perfil, atualizar sessao e navegar para o fluxo principal.",
          icon: "⌂"
        },
        "dentist-home": {
          title: "Painel do profissional",
          subtitle: "Abra um novo caso, acompanhe pacientes e converse com a equipe.",
          context: "Esta area concentra o relato de novos casos, o acompanhamento dos pacientes enviados e o chat do caso.",
          icon: "⌂"
        },
        "tele-home": {
          title: "Painel da teleconsultoria",
          subtitle: "Receba novos casos, responda e acompanhe o chat clinico.",
          context: "O teleconsultor pode assumir o proximo caso, revisar casos atribuidos e registrar a resposta tecnica.",
          icon: "◎"
        },
        "pathology-home": {
          title: "Painel da patologia",
          subtitle: "Acesse casos completos e envie laudos histopatologicos.",
          context: "O patologista consulta os casos pelo nome do paciente, revisa o material clinico e envia o laudo para o profissional e para o teleconsultor.",
          icon: "◉"
        },
        "reg-home": {
          title: "Painel da regulacao",
          subtitle: "Acesse os casos suspeitos detalhados e conduza a fila regulatoria.",
          context: "O regulador trabalha sobre os casos suspeitos, abrindo o detalhe clinico e registrando o desfecho regulatorio.",
          icon: "↗"
        },
        "case-create": {
          title: "Relatar caso",
          subtitle: "Abertura estruturada de novo caso clinico.",
          context: "Preencha os dados do paciente, a historia clinica e os achados principais para iniciar a teleinterconsulta.",
          icon: "+"
        },
        "case-manage": {
          title: "Meus casos",
          subtitle: "Consulta, anexos e submissao dos casos em andamento.",
          context: "Depois de criar o caso, use esta tela para revisar o ID, anexar arquivos e enviar o caso para a fila clinica.",
          icon: "◫"
        },
        chat: {
          title: "Chat do caso",
          subtitle: "Comunicacao direta entre os envolvidos no caso.",
          context: "Use o chat para complementar informacoes, solicitar esclarecimentos e manter o acompanhamento registrado.",
          icon: "✉"
        },
        notifications: {
          title: "Notificacoes",
          subtitle: "Avisos de resposta, mensagem nova e regulacao.",
          context: "Aqui ficam as atualizacoes mais recentes do caso para acompanhamento do profissional e da equipe assistencial.",
          icon: "!"
        },
        tele: {
          title: "Teleconsultoria",
          subtitle: "Fila e resposta clinica do especialista.",
          context: "O teleconsultor usa esta tela para assumir casos, responder e sinalizar suspeitas que demandem regulacao.",
          icon: "◎"
        },
        pathology: {
          title: "Patologia",
          subtitle: "Laudo histopatologico por caso.",
          context: "O patologista revisa o caso completo, acessa as mídias e envia o laudo histopatológico para o profissional e para o teleconsultor.",
          icon: "◉"
        },
        regulation: {
          title: "Telerregulacao",
          subtitle: "Fila de casos suspeitos e encaminhamento regulatorio.",
          context: "O regulador acompanha casos suspeitos, assume a analise e registra o desfecho regulatorio do atendimento.",
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
          subtitle: "Nova pagina de trabalho com relato de caso, acompanhamento e chat."
        },
        ADMIN: {
          title: "Painel administrativo",
          subtitle: "Acesso ampliado aos modulos do fluxo clinico."
        },
        TELECONSULTANT: {
          title: "Painel da teleconsultoria",
          subtitle: "Nova pagina de trabalho com novos casos, resposta e chat."
        },
        PATHOLOGIST: {
          title: "Painel da patologia",
          subtitle: "Nova pagina com casos completos, laudo histopatologico e chat."
        },
        REGULATOR: {
          title: "Painel da regulacao",
          subtitle: "Nova pagina com os casos suspeitos detalhados."
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
      loadDashboard();
    }

    function goToCases() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça login para acessar os módulos de casos.", "error");
        return;
      }
      openWorkspace();
      setAppPage(me === "DENTIST" || me === "ADMIN" ? "case-manage" : getDefaultPageForRole(me));
    }

    function goToTele() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça login para acessar a teleconsultoria.", "error");
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
        showMessage("Faça login para acessar o chat do caso.", "error");
        return;
      }
      openWorkspace();
      setAppPage("chat");
    }

    function goToNotifications() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça login para acessar as notificações.", "error");
        return;
      }
      openWorkspace();
      setAppPage("notifications");
    }

    function goToRegulation() {
      const me = getCurrentRole();
      if (!me) {
        goToAuth();
        showMessage("Faça login para acessar a regulação.", "error");
        return;
      }
      openWorkspace();
      setAppPage("regulation");
    }

    function updateSession(me) {
      currentUser = me || null;
      $("sessionState").textContent = me ? "Sessao ativa" : "Aguardando login";
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
        DENTIST: "Fluxo sugerido: relatar caso, anexar arquivos, submeter, acompanhar notificacoes e conversar pelo chat.",
        TELECONSULTANT: "Fluxo sugerido: pegar o proximo caso, revisar detalhes, responder a teleconsultoria e acompanhar o chat.",
        PATHOLOGIST: "Fluxo sugerido: abrir casos pelo nome do paciente, revisar o caso completo, enviar o laudo histopatológico e acompanhar o chat.",
        REGULATOR: "Fluxo sugerido: consultar a fila regulatoria, assumir casos suspeitos e concluir a telerregulacao.",
        ADMIN: "Fluxo ampliado: acesso tecnico aos modulos principais para suporte e auditoria do fluxo."
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
        assigned: "Em analise",
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

    function setCaseSelection(id) {
      if (!id) return;
      $("case_lookup_id").value = id;
      $("chat_case_id").value = id;
      $("tele_case_id").value = id;
      $("reg_case_id").value = id;
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

    function doLogout() {
      localStorage.removeItem(TOKEN_KEY);
      updateSession(null);
      showMessage("Sessao encerrada.", "success");
      showResult("Sessao encerrada. Faca login novamente para continuar.");
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
        showMessage("Sessao atualizada com sucesso.", "success");
        showResult(me);
      } catch (error) {
        updateSession(null);
        showMessage(error.message || "Falha ao carregar a sessao.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadDashboard() {
      try {
        const [summary, openClosed, byState] = await Promise.all([
          apiFetch("/dashboard/summary"),
          apiFetch("/dashboard/cases-open-vs-closed"),
          apiFetch("/dashboard/cases-by-state"),
        ]);

        setText("dash_since", summary?.since ? formatDateTime(summary.since) : "-");
        setText("dash_total", summary?.total ?? 0);
        setText("dash_draft", summary?.by_status?.draft ?? 0);
        setText("dash_submitted", summary?.by_status?.submitted ?? 0);
        setText("dash_assigned", summary?.by_status?.assigned ?? 0);
        setText("dash_answered", summary?.by_status?.answered ?? 0);
        setText("dash_closed", summary?.by_status?.closed ?? 0);

        showMessage("Dashboard atualizado com sucesso.", "success");
        showResult({ summary, openClosed, byState });
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o dashboard.", "error");
        showResult(String(error.message || error));
      }
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
        ["dentist_state", "UF do servico"],
        ["dentist_municipality", "Municipio do servico"],
        ["unit_name", "Unidade / servico"],
        ["patient_name", "Paciente"],
        ["sus_card", "Cartao SUS"],
        ["patient_phone", "Telefone do paciente"],
        ["patient_sex", "Sexo"],
        ["patient_city", "Municipio do paciente"],
        ["patient_state", "UF do paciente"],
        ["chief_complaint", "Queixa principal"],
        ["hpi", "Historia da doenca atual"],
        ["medical_history", "Historia medica"],
        ["dental_history", "Historia odontologica"],
        ["habits", "Habitos"],
        ["meds_history", "Medicacoes"],
        ["vitals", "Sinais vitais e achados gerais"],
        ["oral_description", "Descricao clinica oral"],
        ["dentist_hypotheses", "Hipoteses diagnosticas"],
        ["lesion_topography", "Topografia da lesao"]
      ];

      for (const [key, label] of required) {
        if (!payload[key]) throw new Error("Preencha o campo: " + label + ".");
      }

      if (!Number.isInteger(payload.patient_age) || payload.patient_age <= 0) {
        throw new Error("Informe uma idade valida.");
      }

      if (payload.dentist_state.length !== 2 || payload.patient_state.length !== 2) {
        throw new Error("As UFs devem conter duas letras.");
      }
    }

    async function createCase(shouldSubmit = false) {
      try {
        const payload = buildCasePayload();
        validateCasePayload(payload);
        const created = await apiFetch("/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const files = getFilesFromFields([
          "case_create_media_file_1",
          "case_create_media_file_2",
          "case_create_media_file_3"
        ]);
        if (created && created.id) {
          setCaseSelection(created.id);
        }
        if (created?.id && files.length) {
          await uploadMediaBatch(created.id, $("case_create_media_type").value, files);
          ["case_create_media_file_1", "case_create_media_file_2", "case_create_media_file_3"].forEach((fieldId) => {
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
            ? (files.length ? "Caso criado, midias anexadas e submetido com sucesso." : "Caso criado e submetido com sucesso.")
            : (files.length ? "Caso criado e midias anexadas com sucesso." : "Caso criado com sucesso."),
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
        $("chat_case_id").value = id;
        fillCaseDetailContext(caseData);
        await loadCaseNotifications();
        showMessage("Caso carregado com sucesso.", "success");
        showResult(caseData);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function submitCase() {
      try {
        const id = Number($("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const submitted = await apiFetch("/cases/" + id + "/submit", {
          method: "POST"
        });
        setCaseSelection(id);
        fillCaseDetailContext(submitted);
        await loadCaseNotifications();
        await loadMyCases(false);
        showMessage("Caso submetido com sucesso.", "success");
        showResult(submitted);
      } catch (error) {
        showMessage(error.message || "Falha ao submeter o caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function uploadCaseMedia() {
      try {
        const id = Number($("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const files = [
          $("case_media_file_1")?.files?.[0],
          $("case_media_file_2")?.files?.[0],
          $("case_media_file_3")?.files?.[0]
        ].filter(Boolean);
        if (!files.length) throw new Error("Selecione ao menos um arquivo.");
        const uploaded = await uploadMediaBatch(id, $("case_media_type").value, files);
        ["case_media_file_1", "case_media_file_2", "case_media_file_3"].forEach((fieldId) => {
          if ($(fieldId)) $(fieldId).value = "";
        });
        showMessage("Midia anexada com sucesso.", "success");
        showResult(uploaded);
      } catch (error) {
        showMessage(error.message || "Falha ao anexar a midia.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadCaseMessages() {
      try {
        const id = Number($("chat_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido para o chat.");
        $("chat_case_id").value = id;
        const messages = await apiFetch("/cases/" + id + "/messages");
        renderChatMessages(messages);
        showMessage("Chat atualizado com sucesso.", "success");
        showResult(messages);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o chat.", "error");
        showResult(String(error.message || error));
      }
    }

    async function sendCaseMessage() {
      try {
        const id = Number($("chat_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido para o chat.");
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
        showMessage("Mensagem enviada com sucesso.", "success");
        showResult(created);
      } catch (error) {
        showMessage(error.message || "Falha ao enviar a mensagem.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadNotifications() {
      try {
        const notifications = await apiFetch("/notifications/mine");
        renderTimeline(
          "case_ctx_notifications",
          notifications.slice(0, 5).map((item) => ({
            meta: `${item.notification_type} • ${item.is_read ? "lida" : "nao lida"}`,
            title: item.title,
            body: item.body,
          })),
          "Nenhuma notificacao encontrada."
        );
        showMessage("Notificacoes atualizadas.", "success");
        showResult(notifications);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar notificacoes.", "error");
        showResult(String(error.message || error));
      }
    }

    async function markNotificationRead() {
      try {
        const id = Number($("notification_id").value);
        if (!id) throw new Error("Informe um ID de notificacao valido.");
        const updated = await apiFetch("/notifications/" + id + "/read", {
          method: "POST"
        });
        showMessage("Notificacao marcada como lida.", "success");
        showResult(updated);
      } catch (error) {
        showMessage(error.message || "Falha ao atualizar a notificacao.", "error");
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
        ["clinical_description", "Descricao clinica / sintese do caso"],
        ["justified_hypotheses", "Hipoteses diagnosticas justificadas"],
        ["clinical_conduct", "Conduta clinica"],
        ["care_coordination", "Coordenacao do cuidado"]
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
        showMessage(data ? "Caso atribuido com sucesso." : "Nenhum caso disponivel na fila.", "success");
        showResult(data || "Nenhum caso disponivel.");
      } catch (error) {
        showMessage(error.message || "Falha ao buscar o proximo caso.", "error");
        showResult(String(error.message || error));
      }
    }

    async function teleMyCases(showFeedback = true) {
      try {
        const data = await apiFetch("/teleconsultor/my-cases");
        populateCaseSelect("tele_case_select", data, "Selecione um caso");
        populateCaseSelect("chat_case_select", data, "Selecione um caso");
        if (showFeedback) showMessage("Casos atribuidos atualizados.", "success");
        showResult(data);
        return data;
      } catch (error) {
        showMessage(error.message || "Falha ao carregar casos atribuidos.", "error");
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
        showMessage("Resposta da teleconsultoria enviada com sucesso.", "success");
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
        const id = Number($("path_case_id").value || $("case_lookup_id").value);
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

    async function submitPathologyReport() {
      try {
        const id = Number($("path_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const diagnosis = $("path_diagnosis").value.trim();
        const report = $("path_report").value.trim();
        if (diagnosis.length < 3) throw new Error("Informe o diagnostico histopatologico.");
        if (report.length < 3) throw new Error("Informe o laudo histopatologico.");
        const data = await apiFetch("/pathologist/cases/" + id + "/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ diagnosis, report })
        });
        setCaseSelection(id);
        fillPathologyCaseContext(data);
        showMessage("Laudo histopatologico enviado com sucesso.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao enviar o laudo histopatologico.", "error");
        showResult(String(error.message || error));
      }
    }

    async function loadRegulationQueue(showFeedback = true) {
      try {
        const data = await apiFetch("/regulator/queue");
        populateCaseSelect("reg_case_select", data, "Selecione um caso suspeito");
        populateCaseSelect("chat_case_select", data, "Selecione um caso");
        if (showFeedback) showMessage("Fila regulatoria atualizada.", "success");
        showResult(data);
        return data;
      } catch (error) {
        showMessage(error.message || "Falha ao carregar a fila regulatoria.", "error");
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
        showMessage("Caso carregado para telerregulacao.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao carregar o caso regulatorio.", "error");
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
        showMessage("Caso assumido para telerregulacao.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao assumir o caso regulatorio.", "error");
        showResult(String(error.message || error));
      }
    }

    async function completeRegulation() {
      try {
        const id = Number($("reg_case_id").value || $("case_lookup_id").value);
        if (!id) throw new Error("Informe um ID de caso valido.");
        const notes = $("reg_notes").value.trim();
        if (notes.length < 3) throw new Error("Preencha as notas regulatorias.");
        const data = await apiFetch("/regulator/cases/" + id + "/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regulation_notes: notes,
            regulation_status: $("reg_status").value
          })
        });
        setCaseSelection(id);
        fillRegulationCaseContext(data);
        showMessage("Telerregulacao concluida com sucesso.", "success");
        showResult(data);
      } catch (error) {
        showMessage(error.message || "Falha ao concluir a telerregulacao.", "error");
        showResult(String(error.message || error));
      }
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
        if (!Number.isInteger(age) || age < 18) throw new Error("Informe uma idade valida.");
        if (!sex) throw new Error("Selecione o sexo.");
        if (address.length < 5) throw new Error("Informe o endereco.");
        if (municipality.length < 2) throw new Error("Informe o municipio.");
        if (state.length !== 2) throw new Error("Informe a UF com 2 letras.");
        if (council_number.length < 2) throw new Error("Informe o numero no conselho profissional.");
        if (profession.length < 2) throw new Error("Informe a profissao.");
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
          throw new Error(loginData.detail || "Falha no login.");
        }

        localStorage.setItem(TOKEN_KEY, loginData.access_token);
        const me = await apiFetch("/auth/me");
        showMessage(`Login realizado com sucesso como ${getRoleLabel(me.role)}.`, "success");
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
        showMessage(error.message || "Falha no login.", "error");
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
    bindEnter("notification_id", markNotificationRead);
    bindEnter("tele_case_id", teleAnswerCase);
    bindEnter("reg_case_id", takeRegulationCase);
    switchTab("login");
    updateSession(null);
    if (localStorage.getItem(TOKEN_KEY)) {
      loadSession();
    } else {
      loadDashboard();
    }
