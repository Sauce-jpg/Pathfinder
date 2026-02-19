/* ============================================================================
   EQUIPMENT BROWSER STYLES
   ============================================================================ */

/* Overlay */
.equipment-browser-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* Modal */
.equipment-browser-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.equipment-browser-header {
  padding: 20px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.equipment-browser-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
  text-transform: capitalize;
}

.equipment-browser-close {
  background: none;
  border: none;
  font-size: 32px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.equipment-browser-close:hover {
  background: #f0f0f0;
  color: #333;
}

/* Controls */
.equipment-browser-controls {
  padding: 16px 20px;
  border-bottom: 1px solid #ddd;
  display: flex;
  gap: 12px;
}

.equipment-browser-search {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.equipment-browser-search:focus {
  outline: none;
  border-color: #0070f3;
}

.equipment-browser-sort {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 180px;
}

/* Items List */
.equipment-browser-items {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.equipment-browser-empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

/* Individual Equipment Item */
.equipment-item {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.equipment-item:hover {
  background: #f8f9fa;
  border-color: #0070f3;
  box-shadow: 0 2px 8px rgba(0, 112, 243, 0.1);
  transform: translateY(-1px);
}

.equipment-item:active {
  transform: translateY(0);
}

.equipment-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.equipment-item-name {
  font-size: 16px;
  font-weight: 600;
  color: #222;
}

.equipment-item-cost {
  font-size: 14px;
  font-weight: 600;
  color: #0070f3;
  background: #e6f2ff;
  padding: 4px 10px;
  border-radius: 4px;
}

/* Item Stats */
.equipment-item-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #555;
}

.equipment-item-stats span {
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 3px;
  font-weight: 500;
}

/* Item Meta */
.equipment-item-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #777;
}

.equipment-item-weight {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 3px;
}

.equipment-item-category {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 500;
}

.equipment-item-description {
  margin: 0;
  font-size: 14px;
  color: #444;
  line-height: 1.5;
}

/* Footer */
.equipment-browser-footer {
  padding: 16px 20px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
}

.equipment-browser-footer span {
  font-size: 14px;
  color: #666;
}

.equipment-browser-footer button {
  padding: 10px 24px;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.equipment-browser-footer button:hover {
  background: #0051cc;
}

/* Loading State */
.equipment-browser-loading {
  padding: 60px 20px;
  text-align: center;
  color: #666;
}

/* Error State */
.equipment-browser-error {
  padding: 40px 20px;
  text-align: center;
}

.equipment-browser-error p {
  color: #d32f2f;
  margin-bottom: 20px;
}

.equipment-browser-error button {
  padding: 10px 24px;
  background: #d32f2f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* ============================================================================
   RESPONSIVE DESIGN
   ============================================================================ */

@media (max-width: 768px) {
  .equipment-browser-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .equipment-browser-controls {
    flex-direction: column;
  }

  .equipment-browser-sort {
    width: 100%;
  }

  .equipment-item-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .equipment-item-stats {
    font-size: 12px;
    gap: 8px;
  }
}

/* ============================================================================
   DARK MODE (Optional)
   ============================================================================ */

@media (prefers-color-scheme: dark) {
  .equipment-browser-modal {
    background: #1a1a1a;
    color: #e0e0e0;
  }

  .equipment-browser-header {
    border-bottom-color: #333;
  }

  .equipment-browser-header h2 {
    color: #e0e0e0;
  }

  .equipment-browser-close {
    color: #aaa;
  }

  .equipment-browser-close:hover {
    background: #2a2a2a;
    color: #e0e0e0;
  }

  .equipment-browser-controls {
    border-bottom-color: #333;
  }

  .equipment-browser-search,
  .equipment-browser-sort {
    background: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }

  .equipment-item {
    background: #2a2a2a;
    border-color: #444;
  }

  .equipment-item:hover {
    background: #333;
    border-color: #0070f3;
  }

  .equipment-item-name {
    color: #e0e0e0;
  }

  .equipment-item-cost {
    background: #0051cc;
    color: white;
  }

  .equipment-item-stats span {
    background: #333;
    color: #bbb;
  }

  .equipment-item-weight {
    background: #333;
    color: #bbb;
  }

  .equipment-item-category {
    background: #1b5e20;
    color: #a5d6a7;
  }

  .equipment-item-description {
    color: #bbb;
  }

  .equipment-browser-footer {
    border-top-color: #333;
    background: #222;
  }

  .equipment-browser-footer span {
    color: #aaa;
  }
}
