
        function refreshIcons() {
            setTimeout(() => lucide.createIcons(), 50);
        }

        function toast(message) {
            const container = document.getElementById('toastContainer');
            const toastEl = document.createElement('div');
            toastEl.className = 'toast';
            toastEl.innerHTML = `<i data-lucide="info" style="width:16px;height:16px;"></i><span>${message}</span>`;
            container.appendChild(toastEl);
            refreshIcons();
            setTimeout(() => toastEl.remove(), 3500);
        }
