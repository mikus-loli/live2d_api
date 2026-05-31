var Live2DAdminAPI = (function () {
  var BASE_URL = 'api/';

  function request(method, endpoint, data, isFormData) {
    var opts = {
      method: method,
      headers: {},
    };
    if (data && !isFormData) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    } else if (data && isFormData) {
      opts.body = data;
    }

    return fetch(BASE_URL + endpoint, opts)
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        if (!json.success) {
          throw new Error(json.message || 'Unknown error');
        }
        return json;
      });
  }

  return {
    request: request,

    getModels: function () {
      return request('GET', 'list.php');
    },

    getModelDetail: function (modelName) {
      return request('GET', 'detail.php?model_name=' + encodeURIComponent(modelName));
    },

    getGroups: function () {
      return request('GET', 'groups.php');
    },

    createModel: function (name, message) {
      return request('POST', 'create.php', { name: name, message: message });
    },

    updateModel: function (oldName, newName, message) {
      return request('POST', 'update.php', { old_name: oldName, new_name: newName, message: message });
    },

    deleteModel: function (name, confirm) {
      return request('POST', 'delete.php', { name: name, confirm: !!confirm });
    },

    uploadFile: function (file, modelName, onProgress) {
      return new Promise(function (resolve, reject) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('model_name', modelName);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', BASE_URL + 'upload.php');

        if (onProgress) {
          xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
        }

        xhr.onload = function () {
          try {
            var json = JSON.parse(xhr.responseText);
            if (json.success) {
              resolve(json);
            } else {
              reject(new Error(json.message || 'Upload failed'));
            }
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        };

        xhr.onerror = function () {
          reject(new Error('Network error'));
        };

        xhr.send(formData);
      });
    },

    login: function (username, password) {
      return request('POST', 'login', { username: username, password: password });
    },

    logout: function () {
      return request('POST', 'logout');
    },

    getStatus: function () {
      return request('GET', 'status');
    },

    changePassword: function (currentPassword, newPassword) {
      return request('POST', 'change_password', { current_password: currentPassword, new_password: newPassword });
    },

    updateProfile: function (currentPassword, newUsername) {
      return request('POST', 'update_profile', { current_password: currentPassword, new_username: newUsername });
    },
  };
})();
