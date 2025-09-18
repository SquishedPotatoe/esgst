import { DOM } from './class/DOM';
import { permissions } from './class/Permissions';
import { Utils } from './lib/jsUtils';

const grantedPermissions = new Set<string>();
const deniedPermissions = new Set<string>();
let messageNode: HTMLElement | undefined;

const loadPermissions = async (): Promise<void> => {
  const params = Utils.getQueryParams();
  const rows: JSX.Element[] = [];

  const keys = params.keys
    ? params.keys.split(',')
    : Object.keys(permissions.permissions);

  for (const key of keys) {
    const permission = permissions.permissions[key];
    if (!permission) continue;

    const permissionCell = permission.values.map((v) => [v, <br />]).flat();
    const usageCell = Object.values(permission.messages)
      .map((v) => [v, <br />, <br />])
      .flat();

    let checkboxNode: HTMLInputElement | undefined;

    rows.push(
      <tr>
        {params.keys ? null : (
          <td>
            <input type="checkbox" ref={(ref) => (checkboxNode = ref)} />
          </td>
        )}
        <td>{permissionCell}</td>
        <td>{usageCell}</td>
      </tr>
    );

    if (checkboxNode) {
      if (permission.required) {
        checkboxNode.checked = true;
        checkboxNode.disabled = true;
      } else {
        // Query Chrome directly
        checkboxNode.checked = await permissions.contains([[key]]);
      }

      checkboxNode.addEventListener('change', () => {
        if (checkboxNode?.checked) {
          grantedPermissions.add(key);
          deniedPermissions.delete(key);
        } else {
          grantedPermissions.delete(key);
          deniedPermissions.add(key);
        }
      });
    }
  }

  // Insert the table, message div, and button first
  DOM.insert(
    document.body,
    'beforeend',
    <fragment>
      <table>
        <tr>
          {params.keys ? null : <th>Granted</th>}
          <th>Permission</th>
          <th>Usage</th>
        </tr>
        {rows}
      </table>
      <div id="permissions-message"></div>
      <button id="permissions-save">{params.keys ? 'Grant' : 'Save'}</button>
    </fragment>
  );

  // Assign messageNode after DOM insertion
  messageNode = document.getElementById('permissions-message')!;

  // Add the click handler after messageNode exists
  const saveButton = document.getElementById('permissions-save')!;
  saveButton.addEventListener('click', savePermissions);
};


const savePermissions = async (): Promise<void> => {
  if (!messageNode) return;

  try {
    // 1️⃣ Request newly granted permissions
    for (const key of grantedPermissions) {
      const hasPermission = await permissions.contains([[key]]);
      if (!hasPermission) {
        const granted = await permissions.request([key]);
        console.log(`[Permissions] ${key} granted?`, granted);
      }
    }

    // 2️⃣ Remove any denied permissions
    for (const key of deniedPermissions) {
      const removed = await permissions.remove([key]);
      console.log(`[Permissions] ${key} removed?`, removed);
    }

    // 3️⃣ Update message
    messageNode.textContent = 'Permissions saved!';
    setTimeout(() => (messageNode!.textContent = ''), 2000);

    // 4️⃣ Optional: clear granted/denied sets
    grantedPermissions.clear();
    deniedPermissions.clear();

    // 5️⃣ Log final permissions for debugging
    const allPerms = await chrome.permissions.getAll();
    console.log('[Permissions] Final permissions:', allPerms);
  } catch (err) {
    messageNode.textContent = 'Error saving permissions!';
    console.error('[Permissions] Error saving permissions:', err);
  }
};

loadPermissions();
