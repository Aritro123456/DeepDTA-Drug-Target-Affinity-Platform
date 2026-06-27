# DeepDTA Drug-Target Affinity Platform

DeepDTA Drug-Target Affinity Platform is a full-stack web application built to make AI-based drug-target interaction research easier to use, understand, and demonstrate.

The main purpose of this website is not just to run a model. It is to turn a complex machine learning workflow into a clearer research experience where users can explore molecules, protein targets, datasets, predictions, and experiments from one organized interface.

## Why This Website Is Useful

Drug discovery and bioinformatics workflows often require many separate steps: preparing molecular inputs, handling protein sequences, running model scripts, checking prediction outputs, managing datasets, and explaining results. For students, researchers, and reviewers, this can become difficult to follow.

This website solves that problem by giving the workflow a single visual interface. A user does not need to understand every backend script before interacting with the system. They can open the website, enter molecular and target information, view results, and understand the overall prediction flow more easily.

## Main Benefits

### 1. Makes Drug-Target Prediction Easier To Understand

Deep learning models for drug-target affinity can feel abstract when they only run through Python scripts or notebooks. This website makes the process more understandable by presenting the workflow through a structured dashboard.

Instead of only seeing code output, users can interact with the prediction process visually. This helps beginners understand what inputs are needed, what the model is trying to estimate, and how the result fits into a drug discovery workflow.

### 2. Reduces Manual Work For Researchers And Students

Without a web interface, users often need to manually move between scripts, datasets, notebooks, and output files. That makes the workflow slower and more error-prone.

This platform reduces that friction by keeping important parts of the process in one place. It helps users focus more on the scientific question and less on repeatedly running commands or searching through files.

### 3. Helps Present Machine Learning Research Professionally

A model project can be technically strong but still difficult for others to understand if it only exists as backend code. This website turns the model into something that can be demonstrated to teachers, recruiters, reviewers, or teammates.

It shows not only that the model can run, but also that the surrounding software system has been considered: frontend design, backend APIs, authentication, security, service separation, and maintainable folder structure.

### 4. Keeps The Website Lighter On Local Machines

AI models can be heavy and can slow down a laptop if they are loaded all the time. This project separates the normal website backend from the heavier model service.

The benefit is that the main website can stay responsive, while the heavy model-related part is started only when prediction or generation is needed. This design is especially useful for local development on machines with limited resources.

### 5. Improves Safety Compared To A Raw Script-Based System

The project has been updated with several security improvements so that it is safer to share and easier to prepare for future deployment.

Sensitive local files such as `.env`, model weights, virtual environments, runtime databases, uploads, and generated logs are not committed to GitHub. Authentication, CSRF protection, restricted CORS, notebook ownership checks, and service-token protection have also been added.

This makes the project more responsible as a public portfolio repository.

### 6. Gives A Better Learning Path For Full-Stack AI Development

This project is useful as a learning example because it combines multiple important areas:

- machine learning model integration
- drug-target affinity prediction
- scientific data handling
- React frontend development
- Flask backend API design
- authentication and session handling
- security hardening
- local service orchestration
- project restructuring for maintainability

Because of this, the website is not only a drug discovery tool. It is also a practical example of how research code can be converted into a usable software product.

## Who Can Benefit From This Project

### Students

Students can use this project to understand how machine learning can be applied in drug discovery and how a research model can be connected to a real website.

### Researchers

Researchers can use the platform as a starting point for organizing molecule, protein, dataset, and prediction workflows in a more accessible interface.

### Recruiters And Reviewers

Recruiters can see that the project goes beyond a basic ML script. It demonstrates full-stack thinking, backend security awareness, frontend integration, local performance optimization, and project organization.

### Developers

Developers can study how the system separates the frontend, backend, model service, and notebook execution service so each part has a clearer responsibility.

## How The Website Is Organized

```text
deepdta-dashboard-main/       React + Vite website interface
backend/                      Flask backend API, auth, sessions, datasets, notebooks
services/model_service.py     Separate heavy AI model service
services/sandbox_executor.py  Separate notebook/code execution service
DeepDTAGen-master/            Original DeepDTAGen research/model code
data/                         Dataset helpers and public sample data
models/                       Local model weights, ignored from GitHub
runtime/                      Local database/uploads/logs, ignored from GitHub
```

This structure makes the project easier to understand because each major responsibility has its own place.

## Local Setup

Clone the repository:

```bat
git clone https://github.com/Aritro123456/DeepDTA-Drug-Target-Affinity-Platform.git
cd DeepDTA-Drug-Target-Affinity-Platform
```

Create a local environment file:

```bat
copy .env.example .env
```

Edit `.env` and replace the placeholder values:

```text
FLASK_SECRET_KEY=replace_with_a_long_random_secret
MODEL_SERVICE_TOKEN=replace_with_a_long_random_model_service_token
```

Install frontend dependencies:

```bat
cd deepdta-dashboard-main
npm install
cd ..
```

The original DeepDTAGen environment file is available here:

```text
DeepDTAGen-master/environment.yml
```

## Running Locally

Start the backend:

```bat
start_backend_light.bat
```

Start the frontend:

```bat
cd deepdta-dashboard-main
npm run dev -- --host 127.0.0.1 --port 5500
```

Open the website:

```text
http://127.0.0.1:5500
```

Optional services:

```bat
start_sandbox_executor.bat
start_model_service.bat
```

## Security And Sharing Notes

This repository is prepared so local secrets and heavy runtime files are not uploaded to GitHub.

Ignored from GitHub:

- `.env`
- `.venv/`
- `runtime/`
- `models/`
- `node_modules/`
- frontend build output
- local databases
- model weights
- generated logs and uploads

This is important because a public AI/ML project should not expose private keys, local databases, trained model files, or generated runtime data accidentally.

## Current Status

This project is currently best suited for local development, demonstration, and portfolio presentation.

For a full public production deployment, the next improvements would be:

- move large datasets/model files to external storage or Git LFS
- use a production database
- deploy frontend and backend separately
- use HTTPS and managed secrets
- add production-grade rate limiting and monitoring
- host the heavy model service on suitable compute
- use a stronger isolated environment for public notebook execution

## Project Goal

The goal of this project is to show how AI research code can become a more usable and understandable web platform.

It demonstrates the journey from model scripts to a structured full-stack application that is easier to explain, easier to use, and more suitable for real-world software presentation.
