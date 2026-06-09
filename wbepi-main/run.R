#!/usr/bin/env Rscript

if (!requireNamespace("rio", quietly = TRUE)) {
  install.packages("rio", repos = "http://cran.us.r-project.org")
}
if (!requireNamespace("dde", quietly = TRUE)) {
  install.packages("dde", repos = "http://cran.us.r-project.org")
}
if (!requireNamespace("remotes", quietly = TRUE)) {
  install.packages("remotes", repos = "http://cran.us.r-project.org")
}
# odin from github is required because cran version is too old
remotes::install_github("mrc-ide/odin", upgrade = "never")

# Install the local package directly
install.packages(".", repos = NULL, type = "source")

library(wbepi)

set.seed(1)
cat("Running SEIRDV simulation in R...\n")
x <- run_seirdv(
  n_populations = 4, 
  ini_S = c(1000, 3000, 12000, 2000),
  ini_I = c(10, 0, 0, 1), 
  beta = 0.2,
  sigma = 1/7,
  gamma = 1/14,
  mu = 0.3,
  interv_delay = 10,
  interv_efficacy = 0.25,
  interv_vacc_type = 2L,
  target_size = 200,
  interv_release = 28,
  time = 365,
  diffusion = 0.1,
  n_sims = 10
)

cat("Simulation finished.\n")
cat("Dimensions:", dim(x), "\n")
cat("Head:\n")
print(head(x))
cat("Tail:\n")
print(tail(x))

cat("Saving results to generated_output.xlsx...\n")
rio::export(x, file = "generated_output.xlsx")
cat("Success!\n")
