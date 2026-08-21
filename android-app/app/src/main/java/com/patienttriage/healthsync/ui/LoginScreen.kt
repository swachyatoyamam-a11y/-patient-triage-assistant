package com.patienttriage.healthsync.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.patienttriage.healthsync.data.ApiClient
import com.patienttriage.healthsync.data.ApiException
import kotlinx.coroutines.launch

/**
 * Logs in against the same /api/auth/login the web app uses — this app
 * doesn't have its own auth system, it reuses the patient account you
 * already have. Ingest specifically requires a PATIENT-role account (see
 * backend/src/routes/health-data.routes.ts); logging in with a staff/admin
 * account will authenticate fine here but fail later with a clear 403 when
 * a sync is attempted.
 */
@Composable
fun LoginScreen(apiClient: ApiClient, onLoginSuccess: (token: String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Patient Triage — Health Sync")
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
        error?.let { Text(it, modifier = Modifier.padding(top = 8.dp)) }
        Button(
            onClick = {
                error = null
                loading = true
                scope.launch {
                    try {
                        val result = apiClient.login(email.trim(), password)
                        onLoginSuccess(result.token)
                    } catch (e: ApiException) {
                        error = e.message
                    } catch (e: Exception) {
                        error = "Couldn't reach the server. Check your connection."
                    } finally {
                        loading = false
                    }
                }
            },
            enabled = !loading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.padding(top = 16.dp),
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(18.dp)) else Text("Sign in")
        }
    }
}
