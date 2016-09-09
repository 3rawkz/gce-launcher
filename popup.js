const $zone = document.querySelector("#zone");
const $disks = document.querySelector("#disks");
const $projectID = document.querySelector("#project_id");
$projectID.value = window.localStorage.projectID;
$projectID.addEventListener("keyup", () => {
  window.localStorage.projectID = $projectID.value;
  sendMessage("set", {key: "project", value: $projectID.value});
});
const $errors = document.querySelector("#errors");
const $machineType = document.querySelector("#machine_type");

function sendMessage(op, req) {
  return new Promise((resolve, reject) => {
    req = req || {};
    req.op = op;
    req.project = window.localStorage.projectID;
    req.zone = $zone.value;
    req.disk = window.localStorage.disk;
    req.machine_type = window.localStorage.type;
    console.log(op, "request", req);
    chrome.runtime.sendMessage(req, (resp) => {
      if (!resp || resp.error) {
	const err = resp && resp.error || chrome.runtime.lastError;
	console.log(op, 'error', err);
	reject(err);
	return;
      }
      console.log(op, "result", resp);
      resolve(resp);
    });
  });
}

function catchErr(p) {
  return p.catch((err) => { $errors.innerText = JSON.stringify(err); });
}

function fetchInstances() {
  return sendMessage("list_instances").then((instances) => {
    let html = "";
    for (let instance of instances) {
      const machineTypeParts = instance.machineType.split("/");
      const machineType = machineTypeParts[machineTypeParts.length - 1];
      const sshURL = "https://ssh.cloud.google.com/" +
	  instance.selfLink.split(
	      "https://content.googleapis.com/compute/v1/")[1];
      html += "<li>" + instance.name + ": " + instance.status + ", " +
	  machineType + ", <a href=\"" + sshURL +
	  "\" target=\"_blank\">SSH</a></li>";
    }
    const ul = document.querySelector("#instances");
    ul.innerHTML = html;
  });
}

function fetchDisks() {
  return sendMessage("list_disks").then((disks) => {
    let html = "";
    for (let disk of disks) {
      html += "<option>" + disk.name + "</option>";
    }
    const val = $disks.value;
    if (val) {
      window.localStorage.disk = val;
      sendMessage("set", {key: "disk", value: disk});
    }
    $disks.innerHTML = html;
    $disks.value = window.localStorage.disk;
  });
}

function fetchMachineTypes() {
  return sendMessage("list_machine_types").then((types) => {
    let html = "";
    for (let type of types) {
      html += "<option>" + type.name + "</option>";
    }
    const val = $machineType.value;
    if (val) {
      window.localStorage.type = val;
      sendMessage("set", {key: "machineType", value: val});
    }
    $machineType.innerHTML = html;
    $machineType.value = window.localStorage.type;
  });
}

function refreshUI() {
  catchErr(
      Promise.all([fetchInstances(), fetchDisks(), fetchMachineTypes()])
	  .then(() => {
	    document.querySelector("#last_updated").innerText = new Date();
	  }));
}

refreshUI();
setInterval(refreshUI, 3000);

document.querySelector("#create").addEventListener(
    "click", () => { catchErr(sendMessage("create_instance")); });
document.querySelector("#cleanup").addEventListener("click", () => {
  catchErr(sendMessage("cleanup_instance"));
});
