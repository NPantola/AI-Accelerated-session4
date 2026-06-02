document.addEventListener("DOMContentLoaded", () => {
  const capabilitiesList = document.getElementById("capabilities-list");
  const capabilitySelect = document.getElementById("capability");
  const registerForm = document.getElementById("register-form");
  const messageDiv = document.getElementById("message");
  const authButton = document.getElementById("auth-button");
  const authStatus = document.getElementById("auth-status");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeModalButton = document.getElementById("close-modal");
  const permissionNote = document.getElementById("permission-note");

  let session = loadStoredSession();

  function loadStoredSession() {
    const storedSession = localStorage.getItem("practiceLeadSession");
    return storedSession ? JSON.parse(storedSession) : null;
  }

  function saveSession(nextSession) {
    session = nextSession;
    if (nextSession) {
      localStorage.setItem("practiceLeadSession", JSON.stringify(nextSession));
    } else {
      localStorage.removeItem("practiceLeadSession");
    }
    updateAuthState();
  }

  function getAuthHeaders() {
    return session?.token
      ? {
          Authorization: `Bearer ${session.token}`,
        }
      : {};
  }

  function showMessage(text, tone) {
    messageDiv.textContent = text;
    messageDiv.className = tone;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function openModal() {
    loginModal.classList.remove("hidden");
    loginModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    loginModal.classList.add("hidden");
    loginModal.setAttribute("aria-hidden", "true");
    loginForm.reset();
  }

  function updateAuthState() {
    const isAuthenticated = Boolean(session?.token);
    authStatus.textContent = isAuthenticated
      ? `Signed in as ${session.user.name}`
      : "Browsing as consultant";
    authStatus.className = `auth-status ${isAuthenticated ? "logged-in" : "logged-out"}`;
    authButton.textContent = isAuthenticated ? "Sign Out" : "Practice Lead Login";
    registerForm.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !isAuthenticated;
    });
    permissionNote.textContent = isAuthenticated
      ? `Managing as ${session.user.role.replace("_", " ")}.`
      : "Practice lead login is required to register or remove consultants.";
  }

  // Function to fetch capabilities from API
  async function fetchCapabilities() {
    try {
      const response = await fetch("/capabilities");
      const capabilities = await response.json();

      // Clear loading message
      capabilitiesList.innerHTML = "";
      capabilitySelect.innerHTML = '<option value="">-- Select a capability --</option>';

      // Populate capabilities list
      Object.entries(capabilities).forEach(([name, details]) => {
        const capabilityCard = document.createElement("div");
        capabilityCard.className = "capability-card";

        const availableCapacity = details.capacity || 0;
        const currentConsultants = details.consultants ? details.consultants.length : 0;

        // Create consultants HTML with delete icons
        const consultantsHTML =
          details.consultants && details.consultants.length > 0
            ? `<div class="consultants-section">
              <h5>Registered Consultants:</h5>
              <ul class="consultants-list">
                ${details.consultants
                  .map(
                    (email) =>
                      `<li><span class="consultant-email">${email}</span>${
                        session?.token
                          ? `<button class="delete-btn" data-capability="${name}" data-email="${email}">Remove</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No consultants registered yet</em></p>`;

        capabilityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Practice Area:</strong> ${details.practice_area}</p>
          <p><strong>Industry Verticals:</strong> ${details.industry_verticals ? details.industry_verticals.join(', ') : 'Not specified'}</p>
          <p><strong>Capacity:</strong> ${availableCapacity} hours/week available</p>
          <p><strong>Current Team:</strong> ${currentConsultants} consultants</p>
          <div class="consultants-container">
            ${consultantsHTML}
          </div>
        `;

        capabilitiesList.appendChild(capabilityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        capabilitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      capabilitiesList.innerHTML =
        "<p>Failed to load capabilities. Please try again later.</p>";
      console.error("Error fetching capabilities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!session?.token) {
      showMessage("Practice lead login is required to remove consultants.", "error");
      return;
    }

    const button = event.target;
    const capability = button.getAttribute("data-capability");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!session?.token) {
      showMessage("Practice lead login is required to register consultants.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const capability = document.getElementById("capability").value;

    try {
      const response = await fetch(
        `/capabilities/${encodeURIComponent(
          capability
        )}/register?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        registerForm.reset();

        // Refresh capabilities list to show updated consultants
        fetchCapabilities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to register. Please try again.", "error");
      console.error("Error registering:", error);
    }
  });

  authButton.addEventListener("click", async () => {
    if (session?.token) {
      try {
        await fetch("/auth/logout", {
          method: "POST",
          headers: getAuthHeaders(),
        });
      } catch (error) {
        console.error("Error logging out:", error);
      }

      saveSession(null);
      fetchCapabilities();
      showMessage("Signed out.", "success");
      return;
    }

    openModal();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed.", "error");
        return;
      }

      saveSession(result);
      closeModal();
      fetchCapabilities();
      showMessage(`Signed in as ${result.user.name}.`, "success");
    } catch (error) {
      showMessage("Failed to sign in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  closeModalButton.addEventListener("click", closeModal);
  loginModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      closeModal();
    }
  });

  // Initialize app
  updateAuthState();
  fetchCapabilities();
});
