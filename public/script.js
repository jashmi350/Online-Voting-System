document.addEventListener('DOMContentLoaded', () => {
  // 1. Student Modal Pop-up Controls
  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const studentModal = document.getElementById('studentModal');
  const modalLoginBtn = document.getElementById('modalLoginBtn');

  if (openModalBtn && studentModal) {
    openModalBtn.addEventListener('click', () => {
      studentModal.style.display = 'flex';
    });
    closeModalBtn.addEventListener('click', () => {
      studentModal.style.display = 'none';
    });
  }

  // 2. Student Login via Modal
  if (modalLoginBtn) {
    modalLoginBtn.addEventListener('click', async () => {
      const studentId = document.getElementById('studentId').value.trim();
      if (!studentId) return alert('Please enter your Student ID');

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
      });
      const data = await res.json();

      if (data.has_voted === 1) {
        alert('Security Notice: This Student ID has already cast a vote!');
        window.location.href = 'results.html';
      } else {
        localStorage.setItem('student_id', studentId);
        window.location.href = 'vote.html';
      }
    });
  }

  // 3. Admin Login Gate Logic
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', async () => {
      const username = document.getElementById('adminUser').value.trim();
      const password = document.getElementById('adminPass').value.trim();

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        document.getElementById('adminLoginContainer').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadAdminData();
      } else {
        alert(data.error);
      }
    });
  }

  // 4. Voting Ballot Render
  const ballotContainer = document.getElementById('ballotContainer');
  if (ballotContainer) {
    const studentId = localStorage.getItem('student_id');
    if (!studentId) {
      alert('Unauthorized access. Please login with your Student ID.');
      window.location.href = 'index.html';
    }
    document.getElementById('displayUser').innerText = `Voter ID: ${studentId}`;

    fetch('/api/candidates')
      .then(res => res.json())
      .then(candidates => {
        const positions = ['Class Representative', 'Student Council Head', 'Student President'];
        let html = '';

        positions.forEach(pos => {
          html += `<div class="ballot-section"><h3>${pos}</h3>`;
          const filtered = candidates.filter(c => c.position === pos);
          if (filtered.length === 0) {
            html += `<p style="color:var(--text-muted); font-size:0.9rem;">No candidates nominated yet.</p>`;
          } else {
            filtered.forEach(c => {
              html += `
                <div style="background:rgba(255,255,255,0.9); padding:14px; border-radius:8px; margin-bottom:10px; border:1px solid #e2e8f0;">
                  <label class="ballot-option" style="margin-bottom:6px; padding:0; background:none;">
                    <input type="radio" name="${pos}" value="${c.id}" required> 
                    <strong style="font-size:1.05rem; color:#1e293b;">${c.name}</strong>
                  </label>
                  <p style="font-size:0.88rem; color:#475569; margin-left:26px; font-style:italic;">"${c.manifesto || 'No manifesto provided.'}"</p>
                </div>`;
            });
          }
          html += `</div>`;
        });
        ballotContainer.innerHTML = html;
      });

    const votingForm = document.getElementById('votingForm');
    votingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(votingForm);
      const votes = {};
      for (let [key, value] of formData.entries()) {
        votes[key] = value;
      }

      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, votes })
      });
      const data = await res.json();

      if (res.ok) {
        alert('Vote successfully recorded!');
        localStorage.removeItem('student_id');
        window.location.href = 'results.html';
      } else {
        alert(data.error);
      }
    });
  }

  // 5. Admin Panel Add Candidate Button
  const addCandBtn = document.getElementById('addCandBtn');
  if (addCandBtn) {
    addCandBtn.addEventListener('click', async () => {
      const name = document.getElementById('candName').value.trim();
      const position = document.getElementById('candPosition').value;
      const manifesto = document.getElementById('candManifesto').value.trim();
      if (!name) return alert('Please enter candidate name');

      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position, manifesto })
      });

      if (res.ok) {
        document.getElementById('candName').value = '';
        document.getElementById('candManifesto').value = '';
        loadAdminData();
        alert('Candidate successfully added to ballot!');
      }
    });
  }

  // 6. Live Results Tally
  const resultsContainer = document.getElementById('resultsContainer');
  if (resultsContainer) {
    fetch('/api/results')
      .then(res => res.json())
      .then(data => {
        const positions = ['Class Representative', 'Student Council Head', 'Student President'];
        let html = '';

        positions.forEach(pos => {
          html += `<div class="ballot-section"><h3>${pos}</h3>`;
          const filtered = data.filter(c => c.position === pos);
          if (filtered.length === 0) {
            html += `<p>No candidates available.</p>`;
          } else {
            filtered.sort((a, b) => b.vote_count - a.vote_count);
            
            html += `<table><tr><th>Candidate Name</th><th>Manifesto Summary</th><th>Total Votes Won</th></tr>`;
            filtered.forEach((c, index) => {
              const badge = index === 0 && c.vote_count > 0 ? ' <span style="background:#22c55e; color:white; padding:2px 8px; border-radius:4px; font-size:0.75rem; margin-left:6px;">LEADING / WINNING</span>' : '';
              html += `<tr>
                <td><b>${c.name}</b>${badge}</td>
                <td style="font-size:0.85rem; color:#475569;">"${c.manifesto}"</td>
                <td><b>${c.vote_count}</b> votes</td>
              </tr>`;
            });
            html += `</table>`;
          }
          html += `</div><br>`;
        });
        resultsContainer.innerHTML = html;
      });
  }
});

async function loadAdminData() {
  const listEl = document.getElementById('candidateList');
  const res = await fetch('/api/candidates');
  const candidates = await res.json();

  if (candidates.length === 0) {
    listEl.innerHTML = '<p style="color:#64748b;">No candidates found.</p>';
  } else {
    let html = '';
    candidates.forEach(c => {
      html += `
        <div class="candidate-card">
          <div>
            <strong>${c.name}</strong> <small>(${c.position})</small><br>
            <span style="font-size:0.8rem; color:#64748b;">"${c.manifesto}"</span>
          </div>
          <button class="danger-btn" onclick="deleteCandidate(${c.id})">Remove Nominee</button>
        </div>`;
    });
    listEl.innerHTML = html;
  }

  const auditRes = await fetch('/api/admin/audit');
  const auditData = await auditRes.json();
  document.getElementById('auditSummary').innerText = `Fairness Status: ${auditData.total_voted} out of ${auditData.total_registered} registered student IDs have voted.`;

  const logEl = document.getElementById('auditLogContainer');
  if (auditData.voters.length === 0) {
    logEl.innerHTML = '<p style="color:#64748b;">No voter activity recorded yet.</p>';
  } else {
    let logHtml = `<table><tr><th>Student ID</th><th>Vote Status</th><th>Timestamp</th></tr>`;
    auditData.voters.forEach(v => {
      logHtml += `<tr>
        <td><code>${v.student_id}</code></td>
        <td>${v.has_voted ? '<span style="color:#22c55e; font-weight:600;">Voted Securely</span>' : '<span style="color:#f59e0b;">Not Voted Yet</span>'}</td>
        <td>${v.voted_at ? v.voted_at : 'N/A'}</td>
      </tr>`;
    });
    logHtml += `</table>`;
    logEl.innerHTML = logHtml;
  }
}

async function deleteCandidate(id) {
  if (!confirm('Are you sure you want to remove this candidate from the election?')) return;
  const res = await fetch(`/api/admin/candidates/${id}`, { method: 'DELETE' });
  if (res.ok) {
    loadAdminData();
  } else {
    alert('Failed to delete candidate.');
  }
}