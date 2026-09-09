document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherLoginToggle = document.getElementById("teacher-login-toggle");
  const teacherStatusLabel = document.getElementById("teacher-status-label");
  const teacherNotice = document.getElementById("teacher-notice");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const closeLoginModal = document.getElementById("close-login-modal");
  const signupButton = signupForm.querySelector("button[type='submit']");

  let teacherSession = null;

  function updateTeacherStatusUI() {
    const isLoggedIn = Boolean(teacherSession);
    teacherStatusLabel.textContent = isLoggedIn
      ? `Signed in as ${teacherSession.username}`
      : "Teacher Login";

    teacherNotice.textContent = isLoggedIn
      ? `Logged in as ${teacherSession.username}. Teacher controls are enabled.`
      : "Teacher login required to register or unregister students.";

    signupButton.disabled = !isLoggedIn;
    signupButton.textContent = isLoggedIn ? "Register Student" : "Teacher Login Required";

    signupForm.querySelectorAll("input, select").forEach((element) => {
      element.disabled = !isLoggedIn;
    });
  }

  function getAuthHeaders() {
    if (!teacherSession) {
      return {};
    }

    return {
      Authorization: teacherSession.authorization,
    };
  }

  function showGlobalMessage(text, type = "error") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showLoginMessage(text, type = "error") {
    loginMessage.textContent = text;
    loginMessage.className = `message ${type}`;
    loginMessage.classList.remove("hidden");

    setTimeout(() => {
      loginMessage.classList.add("hidden");
    }, 5000);
  }

  function toggleLoginModal(show) {
    loginModal.classList.toggle("hidden", !show);
    if (show) {
      document.getElementById("teacher-username").focus();
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    const deleteButton = teacherSession
                      ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                      : "";
                    return `<li><span class="participant-email">${email}</span>${deleteButton}</li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target.closest(".delete-btn");
    if (!button) {
      return;
    }

    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showGlobalMessage(result.message, "success");
        fetchActivities();
      } else {
        showGlobalMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showGlobalMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!teacherSession) {
      showGlobalMessage("Teacher login is required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showGlobalMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showGlobalMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showGlobalMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  teacherLoginToggle.addEventListener("click", () => {
    if (teacherSession) {
      teacherSession = null;
      updateTeacherStatusUI();
      showGlobalMessage("Teacher session ended.", "info");
      return;
    }

    toggleLoginModal(true);
  });

  closeLoginModal.addEventListener("click", () => toggleLoginModal(false));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value.trim();
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/teacher/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showLoginMessage(result.detail || "Login failed.", "error");
        return;
      }

      teacherSession = {
        username: result.username,
        authorization: `Basic ${btoa(`${username}:${password}`)}`,
      };

      updateTeacherStatusUI();
      showLoginMessage(`Logged in as ${result.username}.`, "success");
      loginForm.reset();
      toggleLoginModal(false);
      fetchActivities();
    } catch (error) {
      showLoginMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      toggleLoginModal(false);
    }
  });

  updateTeacherStatusUI();
  fetchActivities();
});
