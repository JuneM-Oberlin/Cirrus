# Cirrus

A lightweight weather web app built with Java that fetches live weather data from OpenWeatherMap and displays it through a simple web interface.

## Overview

Cirrus is a short personal project designed to demonstrate a complete end-to-end application: a Java backend that retrieves live data from an external API and a frontend that presents that data to users.

I built it to practice HTTP networking, JSON parsing, and connecting a backend service to a web UI in a single, easy-to-understand codebase.

## Tech Stack

- Java
- Maven
- Spark Java
- OkHttp
- Gson
- HTML, CSS, JavaScript

## Features

- Fetches live weather data from OpenWeatherMap
- Exposes weather information through a JSON API
- Simple frontend for displaying current conditions
- API keys managed through environment variables

## What This Project Demonstrates

- Backend HTTP client development
- JSON parsing and data mapping
- REST-style API endpoints
- Lightweight web server development
- Build and dependency management with Maven
- Secure handling of API credentials using environment variables

## Architecture

- `WeatherData` — weather data model
- `WeatherService` — communicates with OpenWeatherMap
- `WeatherServer` — Spark Java server and API routes
- `public/` — static frontend assets

## Author

Solo project, maintained by June Muller.
