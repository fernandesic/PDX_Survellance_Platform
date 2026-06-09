#' Process initial compartment states
#'
#' @noRd
#' @author Thibaut Jombart
#' @param x A list of inputs for run_seirdv()
#' @param name The name of the compartment

process_ini_compartment <- function(x, name) {
  if (!is.null(x[[name]])) {
    check_rates(x[[name]])
    if (length(x[[name]]) == 1L) {
      x[[name]] <- rep(x[[name]], length.out = x$n_populations)
    }
    if (!identical(length(x[[name]]), x$n_populations)) {
      msg <- sprintf(
        "Initial state vector for '%s' not matching the number of populations",
        name
      )
      stop(msg)
    }

    ## here we avoid as.integer to handle large numbers
    x[[name]] <- round(x[[name]])
  }
  x
}

