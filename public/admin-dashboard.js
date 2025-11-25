// admin.js - Logique du Dashboard Administrateur
// Vérifier l'authentification
const token = localStorage.getItem('speakfree_token');
const admin = JSON.parse(localStorage.getItem('speakfree_admin') || '{}');

if (!token) {
    window.location.href = '/login';
}

// Afficher les infos de l'admin
document.getElementById('schoolName').textContent = admin.schoolName || 'École';
document.getElementById('adminName').textContent = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Administrateur';

// Headers pour les requêtes API
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

// Charger les données au démarrage
loadDashboardStats();
loadRecentReports();

// ========== STATISTIQUES ==========
function loadDashboardStats() {
    fetch('/api/admin/dashboard', { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                console.error('Erreur:', data.error);
                if (data.error.includes('Token')) {
                    logout();
                }
                return;
            }
            
            // Mettre à jour les statistiques
            document.getElementById('statTotal').textContent = data.total || 0;
            document.getElementById('statPending').textContent = data.pending || 0;
            document.getElementById('statInProgress').textContent = data.inProgress || 0;
            document.getElementById('statResolved').textContent = data.resolved || 0;
        })
        .catch(err => {
            console.error('Erreur chargement stats:', err);
            showError('Erreur de chargement des statistiques');
        });
}

// ========== SIGNALEMENTS RÉCENTS ==========
function loadRecentReports() {
    const container = document.getElementById('recentReportsList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

    fetch('/api/admin/reports?limit=5', { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Erreur</h3><p>${data.error}</p></div>`;
                return;
            }

            if (!data.reports || data.reports.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="icon">📢</div><h3>Aucun signalement</h3><p>Les signalements apparaîtront ici</p></div>';
                return;
            }

            container.innerHTML = data.reports.map(report => createReportCard(report)).join('');
        })
        .catch(err => {
            console.error('Erreur:', err);
            container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Erreur de connexion</h3></div>';
        });
}

// ========== TOUS LES SIGNALEMENTS ==========
function loadAllReports() {
    const container = document.getElementById('allReportsList');
    const statusFilter = document.getElementById('statusFilter').value;
    
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

    let url = '/api/admin/reports?limit=100';
    if (statusFilter) {
        url += `&status=${statusFilter}`;
    }

    fetch(url, { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Erreur</h3><p>${data.error}</p></div>`;
                return;
            }

            if (!data.reports || data.reports.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="icon">📢</div><h3>Aucun signalement</h3><p>Aucun signalement ne correspond aux filtres</p></div>';
                return;
            }

            container.innerHTML = `
                <p style="color: #666; margin-bottom: 15px;">
                    <strong>${data.reports.length}</strong> signalement(s) trouvé(s)
                </p>
                ${data.reports.map(report => createReportCard(report)).join('')}
            `;
        })
        .catch(err => {
            console.error('Erreur:', err);
            container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Erreur de connexion</h3></div>';
        });
}

// ========== CRÉER UNE CARTE DE SIGNALEMENT ==========
function createReportCard(report) {
    const statusClass = `status-${report.status || 'pending'}`;
    const statusText = {
        'pending': '⏳ En attente',
        'in-progress': '🔄 En cours',
        'resolved': '✅ Résolu'
    }[report.status] || '⏳ En attente';

    const typeClass = `type-${report.incident_type}`;
    const typeText = report.incident_type || 'Autre';

    const isUrgent = report.status === 'pending';
    const urgentClass = isUrgent ? 'urgent' : '';

    const date = new Date(report.created_at).toLocaleDateString('fr-FR');
    const time = new Date(report.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="report-card ${urgentClass}" onclick="viewReportDetails(${report.id})">
            <div class="report-header">
                <div>
                    <div class="report-code">${report.tracking_code}</div>
                    <span class="report-type ${typeClass}">${typeText}</span>
                </div>
                <div class="report-date">${date} à ${time}</div>
            </div>
            <div class="report-description">
                ${report.description.substring(0, 150)}${report.description.length > 150 ? '...' : ''}
            </div>
            <div class="report-footer">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <div class="action-btns">
                    <button class="btn btn-view" onclick="event.stopPropagation(); viewReportDetails(${report.id})">
                        👁️ Voir
                    </button>
                    <button class="btn btn-reply" onclick="event.stopPropagation(); replyToReport(${report.id})">
                        💬 Répondre
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ========== VOIR DÉTAILS D'UN SIGNALEMENT ==========
function viewReportDetails(reportId) {
    const modal = document.getElementById('reportModal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';
    modal.classList.add('active');

    fetch(`/api/admin/reports/${reportId}`, { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                modalBody.innerHTML = `<p style="color: red;">Erreur: ${data.error}</p>`;
                return;
            }

            const report = data.report;
            const files = data.files || [];
            const messages = data.messages || [];

            modalBody.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Code de suivi</div>
                        <div class="detail-value">${report.tracking_code}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Type d'incident</div>
                        <div class="detail-value">${report.incident_type}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Date de l'incident</div>
                        <div class="detail-value">${new Date(report.incident_date).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Lieu</div>
                        <div class="detail-value">${report.location}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Témoins</div>
                        <div class="detail-value">${report.witnesses || 'Non spécifié'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Statut</div>
                        <div class="detail-value">
                            <select class="form-control" id="reportStatus" onchange="updateReportStatus(${report.id}, this.value)">
                                <option value="pending" ${report.status === 'pending' ? 'selected' : ''}>En attente</option>
                                <option value="in-progress" ${report.status === 'in-progress' ? 'selected' : ''}>En cours</option>
                                <option value="resolved" ${report.status === 'resolved' ? 'selected' : ''}>Résolu</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <h3 style="margin-bottom: 10px;">Description complète</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; line-height: 1.6;">
                        ${report.description}
                    </div>
                </div>

                ${report.additional_info ? `
                    <div style="margin: 20px 0;">
                        <h3 style="margin-bottom: 10px;">Informations supplémentaires</h3>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; line-height: 1.6;">
                            ${report.additional_info}
                        </div>
                    </div>
                ` : ''}

                ${files.length > 0 ? `
                    <div class="files-list">
                        <h3 style="margin-bottom: 10px;">Fichiers joints (${files.length})</h3>
                        ${files.map(file => `
                            <div class="file-item">
                                <span class="file-icon">${file.file_type.startsWith('image/') ? '🖼️' : '🎥'}</span>
                                <div>
                                    <div>${file.original_name}</div>
                                    <small style="color: #666;">${(file.file_size / 1024 / 1024).toFixed(2)} MB</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${messages.length > 0 ? `
                    <div style="margin: 20px 0;">
                        <h3 style="margin-bottom: 10px;">Discussion (${messages.length} messages)</h3>
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${messages.map(msg => `
                                <div style="padding: 10px; margin-bottom: 10px; background: ${msg.sender_type === 'school' ? '#e3f2fd' : '#f8f9fa'}; border-radius: 8px;">
                                    <strong>${msg.sender_type === 'school' ? '🏫 École' : '👤 Élève'}</strong>
                                    <small style="color: #666; margin-left: 10px;">${new Date(msg.created_at).toLocaleString('fr-FR')}</small>
                                    <p style="margin-top: 8px;">${msg.message}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="reply-form">
                    <h3 style="margin-bottom: 10px;">Répondre à l'élève</h3>
                    <form onsubmit="sendReply(event, ${report.id})">
                        <div class="form-group">
                            <textarea class="form-control" id="replyMessage" placeholder="Écris ton message ici..." required></textarea>
                        </div>
                        <button type="submit" class="action-btn-primary">📤 Envoyer la réponse</button>
                    </form>
                </div>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e9ecef;">
                    <button class="btn btn-delete" onclick="deleteReport(${report.id})">
                        🗑️ Supprimer ce signalement
                    </button>
                </div>
            `;
        })
        .catch(err => {
            console.error('Erreur:', err);
            modalBody.innerHTML = '<p style="color: red;">Erreur de chargement</p>';
        });
}

// ========== METTRE À JOUR LE STATUT ==========
function updateReportStatus(reportId, newStatus) {
    fetch(`/api/admin/reports/${reportId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('❌ Erreur: ' + data.error);
        } else {
            showSuccess('✅ Statut mis à jour');
            refreshData();
        }
    })
    .catch(err => {
        console.error('Erreur:', err);
        alert('❌ Erreur de connexion');
    });
}

// ========== RÉPONDRE À UN SIGNALEMENT ==========
function sendReply(event, reportId) {
    event.preventDefault();
    
    const message = document.getElementById('replyMessage').value;
    
    fetch(`/api/admin/reports/${reportId}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('❌ Erreur: ' + data.error);
        } else {
            showSuccess('✅ Réponse envoyée');
            document.getElementById('replyMessage').value = '';
            // Recharger les détails
            viewReportDetails(reportId);
        }
    })
    .catch(err => {
        console.error('Erreur:', err);
        alert('❌ Erreur d\'envoi');
    });
}

// ========== SUPPRIMER UN SIGNALEMENT ==========
function deleteReport(reportId) {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce signalement ? Cette action est irréversible.')) {
        return;
    }

    fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
        headers
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('❌ Erreur: ' + data.error);
        } else {
            showSuccess('✅ Signalement supprimé');
            closeModal('reportModal');
            refreshData();
        }
    })
    .catch(err => {
        console.error('Erreur:', err);
        alert('❌ Erreur de suppression');
    });
}

// ========== CHARGER LES DISCUSSIONS ==========
function loadDiscussions() {
    const container = document.getElementById('discussionsList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

    fetch('/api/admin/discussions', { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Erreur</h3><p>${data.error}</p></div>`;
                return;
            }

            if (!data.discussions || data.discussions.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="icon">💬</div><h3>Aucune discussion</h3><p>Les discussions actives apparaîtront ici</p></div>';
                return;
            }

            container.innerHTML = data.discussions.map(disc => `
                <div class="report-card" onclick="viewReportDetails(${disc.id})">
                    <div class="report-header">
                        <div>
                            <div class="report-code">${disc.tracking_code}</div>
                            <span class="report-type type-${disc.incident_type}">${disc.incident_type}</span>
                        </div>
                        <div class="report-date">${new Date(disc.last_message).toLocaleString('fr-FR')}</div>
                    </div>
                    <div class="report-footer">
                        <span>${disc.message_count} message(s)</span>
                        <button class="btn btn-view" onclick="event.stopPropagation(); viewReportDetails(${disc.id})">
                            💬 Ouvrir
                        </button>
                    </div>
                </div>
            `).join('');
        })
        .catch(err => {
            console.error('Erreur:', err);
            container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Erreur de connexion</h3></div>';
        });
}

// ========== CHARGER LES STATISTIQUES ==========
function loadStatistics() {
    const container = document.getElementById('statisticsContent');
    const period = document.getElementById('periodFilter').value;
    
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

    fetch(`/api/admin/statistics?period=${period}`, { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Erreur</h3></div>`;
                return;
            }

            let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';

            // Par type d'incident
            if (data.byType && data.byType.length > 0) {
                html += `
                    <div class="chart-container">
                        <h3>📊 Par Type d'Incident</h3>
                        ${data.byType.map(item => `
                            <div style="margin: 10px 0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span>${item.incident_type}</span>
                                    <strong>${item.count}</strong>
                                </div>
                                <div style="background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #667eea; height: 100%; width: ${(item.count / data.byType.reduce((a,b) => a + b.count, 0) * 100)}%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Par statut
            if (data.byStatus && data.byStatus.length > 0) {
                html += `
                    <div class="chart-container">
                        <h3>📈 Par Statut</h3>
                        ${data.byStatus.map(item => `
                            <div style="margin: 10px 0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span>${item.status}</span>
                                    <strong>${item.count}</strong>
                                </div>
                                <div style="background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: ${item.status === 'resolved' ? '#28a745' : item.status === 'in-progress' ? '#17a2b8' : '#ffc107'}; height: 100%; width: ${(item.count / data.byStatus.reduce((a,b) => a + b.count, 0) * 100)}%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            html += '</div>';

            // Timeline
            if (data.timeline && data.timeline.length > 0) {
                html += `
                    <div class="chart-container" style="margin-top: 20px;">
                        <h3>📅 Évolution dans le temps</h3>
                        <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 200px; gap: 5px; margin-top: 20px;">
                            ${data.timeline.map(item => {
                                const maxCount = Math.max(...data.timeline.map(i => i.count));
                                const height = (item.count / maxCount * 100);
                                return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div style="background: #667eea; width: 100%; height: ${height}%; min-height: 2px; border-radius: 5px 5px 0 0;"></div>
                                        <small style="margin-top: 5px; font-size: 0.7em; transform: rotate(-45deg); white-space: nowrap;">${new Date(item.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'})}</small>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;
        })
        .catch(err => {
            console.error('Erreur:', err);
            container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Erreur de connexion</h3></div>';
        });
}

// ========== CHARGER L'ÉQUIPE ==========
function loadTeam() {
    const container = document.getElementById('teamList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';

    fetch('/api/admin/team', { headers })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Erreur</h3></div>`;
                return;
            }

            if (!data.team || data.team.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="icon">👥</div><h3>Aucun membre</h3></div>';
                return;
            }

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                    ${data.team.map(member => `
                        <div class="detail-item" style="padding: 20px;">
                            <div style="text-align: center; margin-bottom: 15px;">
                                <div class="admin-avatar" style="margin: 0 auto;">👤</div>
                            </div>
                            <h3 style="text-align: center; margin-bottom: 10px;">${member.first_name} ${member.last_name}</h3>
                            <p style="text-align: center; color: #666; margin-bottom: 15px;">${member.position}</p>
                            <div style="font-size: 0.9em;">
                                <p>📧 ${member.email}</p>
                                <p>📞 ${member.phone}</p>
                                <p style="color: #999; margin-top: 10px;">Membre depuis ${new Date(member.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        })
        .catch(err => {
            console.error('Erreur:', err);
            container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Erreur de connexion</h3></div>';
        });
}

// ========== CHANGER LE MOT DE PASSE ==========
function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        alert('❌ Les mots de passe ne correspondent pas');
        return;
    }
    
    fetch('/api/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentPassword, newPassword })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert('❌ Erreur: ' + data.error);
        } else {
            showSuccess('✅ Mot de passe changé avec succès');
            document.getElementById('changePasswordForm').reset();
        }
    })
    .catch(err => {
        console.error('Erreur:', err);
        alert('❌ Erreur de connexion');
    });
}

// ========== NAVIGATION ==========
function showSection(sectionId) {
    // Masquer toutes les sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Désactiver tous les menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Afficher la section demandée
    document.getElementById(sectionId).classList.add('active');

    // Activer le menu item correspondant
    event.target.closest('.menu-item').classList.add('active');

    // Mettre à jour le titre
    const titles = {
        'dashboard': 'Tableau de Bord',
        'reports': 'Tous les Signalements',
        'discussions': 'Discussions Actives',
        'statistics': 'Statistiques Détaillées',
        'team': 'Équipe Administrative',
        'settings': 'Paramètres'
    };
    document.getElementById('pageTitle').textContent = titles[sectionId] || 'Dashboard';

    // Charger les données si nécessaire
    if (sectionId === 'reports') loadAllReports();
    if (sectionId === 'discussions') loadDiscussions();
    if (sectionId === 'statistics') loadStatistics();
    if (sectionId === 'team') loadTeam();
    if (sectionId === 'settings') loadSettings();
}

// ========== CHARGER LES PARAMÈTRES ==========
function loadSettings() {
    fetch(`/api/schools/${admin.schoolCode}`, { headers })
        .then(res => res.json())
        .then(data => {
            if (!data.error) {
                document.getElementById('settingsSchoolCode').textContent = data.school_code;
                document.getElementById('settingsSchoolName').textContent = data.name;
                document.getElementById('settingsCity').textContent = data.city;
                document.getElementById('settingsStatus').textContent = data.status === 'active' ? 'Active' : 'Inactive';
            }
        })
        .catch(err => console.error('Erreur:', err));
}

// ========== UTILITAIRES ==========
function refreshData() {
    loadDashboardStats();
    loadRecentReports();
    if (document.getElementById('reports').classList.contains('active')) {
        loadAllReports();
    }
}

function filterReports() {
    loadAllReports();
}

function replyToReport(reportId) {
    viewReportDetails(reportId);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function logout() {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        localStorage.removeItem('speakfree_token');
        localStorage.removeItem('speakfree_admin');
        window.location.href = '/login';
    }
}

function showSuccess(message) {
    // Simple alert pour l'instant
    alert(message);
}

function showError(message) {
    alert('❌ ' + message);
}

// Fermer modal en cliquant à l'extérieur
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}