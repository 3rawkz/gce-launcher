const $zone = document.querySelector("#zone");
$zone.addEventListener("change", () => {
  const val = $zone.value;
  if (val) {
    window.localStorage.zone = val;
    sendMessage("set", {key: "zone", value: zone});
  }
});
const $disks = document.querySelector("#disks");
$disks.addEventListener("change", () => {
  const val = $disks.value;
  if (val) {
    window.localStorage.disk = val;
    sendMessage("set", {key: "disk", value: val});
  }
});
const $projectID = document.querySelector("#project_id");
$projectID.value = window.localStorage.projectID;
$projectID.addEventListener("keyup", () => {
  window.localStorage.projectID = $projectID.value;
  sendMessage("set", {key: "project", value: $projectID.value});
});
const $errors = document.querySelector("#errors");
const $machineType = document.querySelector("#machine_type");
$machineType.addEventListener("change", () => {
  const val = $machineType.value;
  if (val) {
    window.localStorage.type = val;
    sendMessage("set", {key: "machineType", value: val});
  }
});
const $instances = document.querySelector("#instances");

const priceURL =
    'https://cloudpricingcalculator.appspot.com/static/data/pricelist.json';
const pricing = catchErr(fetch(priceURL).then((resp) => resp.json()));

function sendMessage(op, req) {
  return new Promise((resolve, reject) => {
    req = req || {};
    req.op = op;
    req.project = req.project || window.localStorage.projectID;
    req.zone = req.zone || $zone.value;
    req.disk = req.disk || window.localStorage.disk;
    req.machine_type = req.machine_type || window.localStorage.type;
    console.log(op, "request", req);
    chrome.runtime.sendMessage(req, (resp) => {
      const err = resp && resp.error || !resp && chrome.runtime.lastError;
      if (err) {
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
    for (let instance of(instances || [])) {
      const machineTypeParts = instance.machineType.split("/");
      const machineType = machineTypeParts[machineTypeParts.length - 1];
      const sshURL = "https://ssh.cloud.google.com/" +
	  instance.selfLink.split(
	      "https://content.googleapis.com/compute/v1/")[1];
      html += "<li>" + instance.name + ": " + instance.status + ", " +
	  machineType + "<br><a href=\"" + sshURL +
	  "\" target=\"_blank\">SSH</a> " + "<a href=\"#\" data-name=" +
	  JSON.stringify(instance.name) + ">Shutdown</a>" + "</li>";
    }
    $instances.innerHTML = html;
  });
}

function fetchDisks() {
  return sendMessage("list_disks").then((disks) => {
    let html = "";
    for (let disk of disks) {
      html += "<option>" + disk.name + "</option>";
    }
    $disks.innerHTML = html;
    $disks.value = window.localStorage.disk;
  });
}

function fetchZones() {
  return sendMessage("list_zones").then((types) => {
    let html = "";
    for (let type of types) {
      html += "<option>" + type.name + "</option>";
    }
    $zone.innerHTML = html;
    $zone.value = window.localStorage.zone;
  });
}

function fetchMachineTypes() {
  return Promise.all([sendMessage("list_machine_types"), pricing])
      .then(([types, pricing]) => {
	let html = "";
	const region = window.localStorage.zone.split("-")[0];
	for (let type of types) {
	  const price = pricing.gcp_price_list["CP-COMPUTEENGINE-VMIMAGE-"+type.name.toUpperCase()][region];
	  html += "<option value=\"" + type.name + "\">" + type.name + " $" + price +"/h</option>";
	}
	$machineType.innerHTML = html;
	$machineType.value = window.localStorage.type;
      });
}

function refreshUI() {
  catchErr(Promise.all([fetchInstances(), fetchDisks()]).then(() => {
    document.querySelector("#last_updated").innerText = new Date();
  }));
}

refreshUI();
setInterval(refreshUI, 3000);
catchErr(Promise.all([fetchMachineTypes(), fetchZones()]));

document.querySelector("#create").addEventListener(
    "click", () => { catchErr(sendMessage("create_instance")); });

$instances.addEventListener("click", (e) => {
  if (e.target.innerText === "Shutdown") {
    shutdown(e.target.dataset.name);
  }
});

function shutdown(name) {
  if (confirm("Shutdown " + name + "?")) {
    catchErr(sendMessage("cleanup_instance", {name: name}));
  }
}
