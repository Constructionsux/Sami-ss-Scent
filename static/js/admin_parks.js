let allParks = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadParksStats();
    await loadParks();
});

async function loadParksStats() {
    try {
        const stats = await adminFetch('/api/admin/parks/stats');
        document.getElementById('statTotalParks').textContent = stats.total_parks;
        document.getElementById('statTotalCities').textContent = stats.total_cities;
        document.getElementById('statAvgFee').textContent = '₦' + stats.avg_fee.toLocaleString(undefined, {minimumFractionDigits: 2});
    } catch (error) {
        console.error('Failed to load parks stats:', error);
    }
}

async function loadParks() {
    try {
        allParks = await adminFetch('/api/admin/parks');
        const tbody = document.getElementById('parksTableBody');
        
        if (allParks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No delivery parks found</td></tr>';
            return;
        }

        tbody.innerHTML = allParks.map(park => `
            <tr>
                <td><strong>${park.state}</strong></td>
                <td>${park.city}</td>
                <td>${park.park_name}</td>
                <td>₦${park.fee.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>
                    <span class="status-badge ${park.is_active ? 'status-verified' : 'status-rejected'}">
                        ${park.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="openEditParkModal('${park.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-secondary btn-sm" style="color:#ef4444; border-color:#ef4444;" onclick="deletePark('${park.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load parks:', error);
        document.getElementById('parksTableBody').innerHTML = 
            `<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 2rem;">Failed to load parks</td></tr>`;
    }
}

function openAddParkModal() {
    document.getElementById('modalTitle').textContent = 'Add New Delivery Park';
    document.getElementById('parkForm').reset();
    document.getElementById('editParkId').value = '';
    document.getElementById('parkStatus').value = 'true';
    openModal('parkModal');
}

function openEditParkModal(parkId) {
    const park = allParks.find(p => p.id === parkId);
    if (!park) return;

    document.getElementById('modalTitle').textContent = 'Edit Delivery Park';
    document.getElementById('editParkId').value = park.id;
    document.getElementById('parkState').value = park.state;
    document.getElementById('parkCity').value = park.city;
    document.getElementById('parkName').value = park.park_name;
    document.getElementById('parkFee').value = park.fee;
    document.getElementById('parkStatus').value = park.is_active.toString();

    openModal('parkModal');
}

// Handle Form Submission (Add or Edit)
document.getElementById('parkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('parkSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const editId = document.getElementById('editParkId').value;
    const isEdit = !!editId;

    const formData = new FormData();
    formData.append('state', document.getElementById('parkState').value.trim());
    formData.append('city', document.getElementById('parkCity').value.trim());
    formData.append('park_name', document.getElementById('parkName').value.trim());
    formData.append('fee', parseFloat(document.getElementById('parkFee').value));
    formData.append('is_active', document.getElementById('parkStatus').value === 'true');

    try {
        if (isEdit) {
            await adminFetch(`/api/admin/parks/${editId}`, {
                method: 'PATCH',
                body: formData
            });
            alert('Park updated successfully!');
        } else {
            await adminFetch('/api/admin/parks', {
                method: 'POST',
                body: formData
            });
            alert('Park added successfully!');
        }
        closeModal('parkModal');
        await loadParks();
        await loadParksStats();
    } catch (error) {
        alert('Failed to save park: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

async function deletePark(parkId) {
    if (!confirm('Are you sure you want to permanently delete this delivery park?')) return;
    
    try {
        await adminFetch(`/api/admin/parks/${parkId}`, {
            method: 'DELETE'
        });
        await loadParks();
        await loadParksStats();
    } catch (error) {
        alert('Failed to delete park: ' + error.message);
    }
}
