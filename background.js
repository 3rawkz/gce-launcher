const CLIENT_ID =
    "82527149933-0b4975omj32if91m551eqb3q8bmmdcbv.apps.googleusercontent.com";
const API_KEY = "AIzaSyCxck1nrcctZa_WX4-JDwOBTMOBCOQqzxo";
const SCOPES = 'https://www.googleapis.com/auth/compute';

function getProject() {
  return window.localStorage.project;
}

function getZone() {
  return window.localStorage.zone;
}

function getDisk() {
  return window.localStorage.disk;
}

function onLoadFn() {
  gapi.client.setApiKey(API_KEY);
  Promise.all([gapi.client.load('compute', "v1"), auth()]).then(() => {
    heartbeat();
    setInterval(heartbeat, 30000);
  });
}

function auth() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      if (!token) {
	alert('login failed!');
	reject();
	return;
      }
      gapi.auth.setToken({access_token: token});
      resolve();
    });
  });
}

const listeners = {
  list_instances: (request) => gapi.client.compute.instances
				   .list({
				     project: request.project || getProject(),
				     zone: request.zone || getZone(),
				     filter: 'status ne TERMINATED'
				   })
				   .then((resp) => resp.result.items),

  list_zones: (request) => gapi.client.compute.zones
				   .list({
				     project: request.project || getProject(),
				   })
				   .then((resp) => resp.result.items),

  list_disks: (request) => gapi.client.compute.disks
			       .list({
				 project: request.project || getProject(),
				 zone: request.zone || getZone(),
			       })
			       .then((resp) => resp.result.items),

  list_machine_types: (request) =>
			  gapi.client.compute.machineTypes
			      .list({
				project: request.project || getProject(),
				zone: request.zone || getZone(),
			      })
			      .then((resp) => resp.result.items),

  create_instance: (request) => {
    const zone = request.zone || getZone();
    const disk_name = request.disk || getDisk();
    const disk = {
      source: "zones/" + zone + "/disks/" + disk_name,
      type: 'PERSISTENT',
      boot: true
    };
    const network = {
      network: "global/networks/default",
      name: "nic0",
      accessConfigs: [{
	type: "ONE_TO_ONE_NAT",
	name: "External NAT",
      }]
    };
    const instance = {
      name: "instance-" + disk_name,
      disks: [disk],
      machineType: "zones/" + zone + "/machineTypes/" + request.machine_type,
      networkInterfaces: [network],
      tags: {items: ["http-server", "https-server"]},
      serviceAccounts: [{
	email: "default",
	scopes: [
	  "https://www.googleapis.com/auth/logging.write",
	  "https://www.googleapis.com/auth/monitoring.write",
	  "https://www.googleapis.com/auth/compute",
	  "https://www.googleapis.com/auth/servicecontrol",
	  "https://www.googleapis.com/auth/service.management.readonly",
	  "https://www.googleapis.com/auth/devstorage.read_only"
	]
      }]
    };
    return gapi.client.compute.instances
	.insert({
	  project: request.project || getProject(),
	  zone: zone,
	  resource: instance,
	})
	.then((resp) => resp.result);
  },

  cleanup_instance:
      (request) => gapi.client.compute.instances
		       .delete({
			 project: request.project || getProject(),
			 zone: request.zone || getZone(),
			 instance: request.name,
		       })
		       .then((resp) => resp.result),

  get: (request) => Promise.resolve(window.localStorage[request.key]),

  set: (request) => {
    window.localStorage[request.key] = request.value;
    return Promise.resolve(window.localStorage[request.key]);
  },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request.op, "request", request);
  const listener = listeners[request.op];
  if (listener) {
    auth()
	.then(() => listener(request, sender))
	.then((result) => {
	  console.log(request.op, "result", result);
	  sendResponse(result);
	})
	.catch((err) => {
	  console.log(request.op, "error", err);
	  sendResponse({error: err});
	});
    return true;
  }
  sendResponse({error: "no handler for " + request.op});
});

function onGAPILoad() {
  gapi.load("client:auth", onLoadFn);
}

var head = document.getElementsByTagName('head')[0];
var script = document.createElement('script');
script.type = 'text/javascript';
script.src = "https://apis.google.com/js/client.js?onload=onGAPILoad";
head.appendChild(script);

const heartbeatKey = "heartbeat";

function heartbeat() {
  const mtime = moment().add(5, 'minutes');
  const time = mtime.toJSON();
  const project = getProject();
  const zone = getZone();
  console.log("heartbeat start");
  auth()
      .then(() => listeners.list_instances({project: project, zone: zone}))
      .then((instances) => {
	if (!instances) {
	  return;
	}
	const promises = [];

	instances: for (let instance of instances) {
	  const meta = instance.metadata;
	  if (!meta.items) {
	    meta.items = [];
	  }
	  let found = false;
	  for (let kv of meta.items) {
	    if (kv.key === heartbeatKey) {
	      if (!mtime.isAfter(kv.value)) {
		continue instances;
	      }
	      kv.value = time;
	      found = true;
	    }
	  }
	  if (!found) {
	    meta.items.push({key: heartbeatKey, value: time});
	  }
	  console.log("heartbeat updating", instance.name);
	  promises.push(gapi.client.compute.instances.setMetadata({
	    project: project,
	    zone: zone,
	    instance: instance.name,
	    resource: meta,
	  }));
	}
	return Promise.all(promises);
      })
      .then(() => console.log("heartbeat success"))
      .catch((err) => { console.log("heartbeat err", err); });
}
